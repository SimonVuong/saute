import { EOrder, IOrder } from './../../order/orderModel';
import { IMeal } from './../../rest/mealModel';
import { getPlanService } from './../plans/planService';
import { RenewalTypes } from './../../consumer/consumerModel';
import { SignedInUser } from './../utils/models';
import { getConsumerService } from './../consumer/consumerService';
import { ICartInput, Cart } from './../../order/cartModel';
import { getGeoService } from './../place/geoService';
import { getRestService } from './../rests/restService';
import { getCannotBeEmptyError } from './../utils/error';
import { isDate2DaysLater } from './../../order/utils';
import { initElastic, SearchResponse } from './../elasticConnector';
import { Client, ApiResponse } from '@elastic/elasticsearch';
import { Order } from '../../order/orderModel';
import Stripe from 'stripe';
import { activeConfig } from '../../config';
import { Consumer } from '../../consumer/consumerModel';
import moment from 'moment';
import { MutationBoolRes } from '../../utils/mutationResModel';

const ORDER_INDEX = 'orders';

/**
 * Returns a fn, Chooser, that returns a random element in arr. Chooser always returns unique elements until all uniques
 * are returned at which point the chooser "resets". Upon a reset, Chooser returns another cycle of unique elements.
 * Therefore repeat values only occur from mulitple cycles.
 * @param arr the array which contains items to be chosen
 */
const getItemChooser = <T>(arr: T[]) => {
  let copy = arr.slice(0);
  return () => {
    if (copy.length < 1) {
      copy = arr.slice(0);
    }
    const index = Math.floor(Math.random() * copy.length);
    return copy.splice(index, 1)[0];
  };
}

class OrderService {
  private readonly elastic: Client
  private readonly stripe: Stripe

  public constructor(elastic: Client, stripe: Stripe) {
    this.elastic = elastic;
    this.stripe = stripe;
  }

  async placeOrder(signedInUser: SignedInUser, cart: ICartInput): Promise<MutationBoolRes> {
    try {
      if (!cart.phone) {
        const msg = getCannotBeEmptyError('Phone number');
        console.warn('[OrderService]', msg);
        return {
          res: false,
          error: msg
        }
      }
      if (!Consumer.isDeliveryDayValid(cart.consumerPlan.deliveryDay)) {
        const msg = `Delivery day '${cart.consumerPlan.deliveryDay}' must be 0, 1, 2, 3, 4, 5, 6`;
        console.warn('[OrderService]', msg);
        return {
          res: false,
          error: msg
        }
      }
      if (!isDate2DaysLater(cart.deliveryDate)) {
        const msg = `Delivery date '${cart.deliveryDate}' is not 2 days in advance`;
        console.warn('[OrderService]', msg);
        return {
          res: false,
          error: msg,
        }
      }

      const p1 = getRestService().getRest(cart.restId, ['menu']).then(rest => {
        if (!rest) {
          const msg = `Can't find rest '${cart.restId}'`
          console.warn('[OrderService]', msg);
          return msg;
        }
        for (let i = 0; i < cart.meals.length; i++) {
          if (!rest.menu.find(meal => meal._id === cart.meals[i].mealId)) {
            const msg = `Can't find mealId '${cart.meals[i].mealId}'`
            console.warn('[OrderService]', msg);
            return msg;
          }
        }
        return '';
      }).catch(e => {
        const msg = `Couldn't find rest '${cart.restId}'`
        console.warn('[OrderService]', msg, e.stack);
        return msg;
      });
      
      const {
        address1,
        city,
        state,
        zip,
      } = cart.destination.address;
      const p2 = getGeoService().getGeocode(address1, city, state, zip)
        .then(() => '')  
        .catch(e => {
          const msg = `Couldn't verify address '${address1} ${city} ${state}, ${zip}'`
          console.warn('[OrderService]', msg, e.stack);
          return msg;
        })

      const planId = cart.consumerPlan.stripePlanId;
      const cartMealCount = Cart.getMealCount(cart.meals);
      const p3 = getPlanService().getPlan(planId)
        .then(stripePlan => {
          if (!stripePlan) {
            const msg = `Can't find plan '${planId}'`
            console.warn('[OrderService]', msg);
            return msg;
          }
          if (cartMealCount !== stripePlan.mealCount) {
            const msg = `Plan meal count '${stripePlan.mealCount}' does't match cart meal count '${cartMealCount}' for plan '${planId}'`
            console.warn('[OrderService]', msg);
            return msg;
          }
          return '';
        })
        .catch(e => {
          const msg = `Couldn't verify plan '${planId}'`
          console.warn('[OrderService]', msg, e.stack);
          return msg;
        })

      const messages = await Promise.all([p1, p2, p3]);
      if (messages[0]) {
        return {
          res: false,
          error: messages[0]
        }
      }
      if (messages[1]) {
        return {
          res: false,
          error: messages[1]
        }
      }
      if (messages[2]) {
        return {
          res: false,
          error: messages[2]
        }
      }

      const {
        deliveryDay,
        renewal,
        cuisines,
      } = cart.consumerPlan;

      if (renewal === RenewalTypes.Auto && cuisines.length === 0) {
        const msg = `Cuisines cannot be empty if renewal type is '${renewal}'`;
        console.warn('[OrderService]', msg);
        return {
          res: false,
          error: msg,
        }
      }

      let stripeCustomerId = signedInUser.stripeCustomerId;
      let subscription: Stripe.Subscription;

      let subUpdater: Promise<void | Stripe.Subscription> = Promise.resolve();
      if (signedInUser.stripeSubscriptionId && stripeCustomerId) {
        subscription = await this.stripe.subscriptions.retrieve(signedInUser.stripeSubscriptionId);
        subUpdater = this.stripe.subscriptions.update(signedInUser.stripeSubscriptionId, {
          proration_behavior: 'none',
          items: [{
            id: subscription.items.data[0].id,
            plan: planId,
          }]
        });
      } else {
        const stripeCustomer = await this.stripe.customers.create({
          payment_method: cart.paymentMethodId,
          email: signedInUser.profile.email,
          invoice_settings: {
            default_payment_method: cart.paymentMethodId,
          },
        });
        stripeCustomerId = stripeCustomer.id;
        try {
          subscription = await this.stripe.subscriptions.create({
            customer: stripeCustomerId,
            // fails on any id that isn't an active stripe plan
            items: [{ plan: planId }]
          });
        } catch (e) {
          // delete stripe customer to avoid zombie stripe customers
          await this.stripe.customers.del(stripeCustomerId);
          throw e;
        }
      }

      const order = Order.getNewOrderFromCartInput(
        signedInUser,
        cart,
        subscription.id,
        parseFloat(subscription.plan!.metadata.mealPrice),
        subscription.plan!.amount! / 100,
      );
      const indexer = this.elastic.index({
        index: ORDER_INDEX,
        body: order
      })
      const consumerUpserter = getConsumerService().upsertConsumer(signedInUser._id, {
        createdDate: Date.now(),
        stripeCustomerId,
        stripeSubscriptionId: subscription.id,
        plan: {
          stripePlanId: planId,
          deliveryDay,
          renewal,
          cuisines,
        },
        profile: {
          name: signedInUser.profile.name,
          email: signedInUser.profile.email,
          phone: cart.phone,
          card: cart.card,
          destination: cart.destination,
        }
      });

      if (cart.consumerPlan.renewal === RenewalTypes.Auto) {
        getRestService().getRestsByCuisines(cart.consumerPlan.cuisines, ['menu'])
          .then(rests => {
            const rest = rests[Math.floor(Math.random() * rests.length)];
            const menu = rest.menu;
            const chooseRandomly = getItemChooser<IMeal>(menu);
            const meals: IMeal[] = [];
            for (let i = 0; i < cartMealCount; i++) meals.push(chooseRandomly())
            const cartMeals = Cart.getCartMeals(meals);
            const newCart = {
              ...cart,
              restId: rest._id,
              meals: cartMeals,
              deliveryDate: moment(cart.deliveryDate).add(1, 'w').valueOf(),
            }
            const order = Order.getNewOrderFromCartInput(
              signedInUser,
              newCart,
              subscription.id,
              parseFloat(subscription.plan!.metadata.mealPrice),
              subscription.plan!.amount! / 100,
            );
            return this.elastic.index({
              index: ORDER_INDEX,
              body: order
            })
          })
          .catch(e => {
            console.error('[OrderService] could not auto pick rests', e.stack);
          })
      }

      await Promise.all([subUpdater, consumerUpserter, indexer]);

      return {
        res: true,
        error: null
      };
    } catch (e) {
      console.error('[OrderService] could not place order', e.stack);
      throw new Error('Internal Server Error');
    }
  }

  async getMyUpcomingOrders(signedInUser: SignedInUser): Promise<IOrder[]> {
    try {
      const res: ApiResponse<SearchResponse<EOrder>> = await this.elastic.search({
        index: ORDER_INDEX,
        size: 1000,
        body: {
          query: {
            bool: {
              filter: {
                bool: {
                  must: [
                    {
                      range: {
                        deliveryDate: {
                          gte: Date.now(),
                        }
                      },
                    },
                    {
                      term: {
                        'consumer._id': signedInUser._id
                      }
                    }
                  ]
                }
              }
            }
          },
          sort: [
            {
              deliveryDate: {
                order: 'asc',
              }
            }
          ],
        }
      });
      return await Promise.all(res.body.hits.hits.map(async ({ _id, _source }) => {
        const rest = await getRestService().getRest(_source.rest.restId)
        if (!rest) throw Error(`Couldn't get rest ${_source.rest.restId}`);
        return Order.getIOrderFromEOrder(_id, _source, rest)
      }))
    } catch (e) {
      console.error(`[OrderService] couldn't get upcoming orders for '${signedInUser._id}'. '${e.stack}'`);
      throw new Error('Internal Server Error');
    }
  }
}

let orderService: OrderService;

export const initOrderService = (elastic: Client, stripe: Stripe) => {
  if (orderService) throw new Error('[OrderService] already initialized.');
  orderService = new OrderService(elastic, stripe);
};

export const getOrderService = () => {
  if (orderService) return orderService;
  initOrderService(initElastic(), new Stripe(activeConfig.server.stripe.key, {
    apiVersion: '2019-12-03',
  }));
  return orderService;
}
