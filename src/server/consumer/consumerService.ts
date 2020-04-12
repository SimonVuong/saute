import { IAddress } from './../../place/addressModel';
import { IGeoService, getGeoService } from './../place/geoService';
import { getNotSignedInErr } from './../utils/error';
import { MutationConsumerRes } from './../../utils/apolloUtils';
import { getAuth0Header } from './../auth/auth0Management';
import fetch, { Response } from 'node-fetch';
import { IOrderService, getOrderService } from './../orders/orderService';
import { manualAuthSignUp} from './../auth/authenticate';
import { IPlanService, getPlanService } from './../plans/planService';
import { EConsumer, IConsumer, IConsumerPlan, Consumer, IConsumerProfile } from './../../consumer/consumerModel';
import { initElastic, SearchResponse } from './../elasticConnector';
import { Client, ApiResponse } from '@elastic/elasticsearch';
import express from 'express';
import { SignedInUser, MutationBoolRes } from '../../utils/apolloUtils';
import { activeConfig } from '../../config';
import Stripe from 'stripe';
import { OutgoingMessage, IncomingMessage } from 'http';
import crypto  from 'crypto';

const CONSUMER_INDEX = 'consumers';
export interface IConsumerService {
  cancelSubscription: (signedInUser: SignedInUser, req?: IncomingMessage, res?: OutgoingMessage) => Promise<MutationBoolRes>
  signUp: (email: string, name: string, pass: string, res: express.Response) => Promise<MutationConsumerRes>
  updateAuth0MetaData: (userId: string, stripeSubscriptionId: string, stripeCustomerId: string) =>  Promise<Response>
  upsertConsumer: (userId: string, consumer: EConsumer) => Promise<IConsumer>
  upsertMarketingEmail(email: string, name?: string, addr?: IAddress): Promise<MutationBoolRes>
  updateMyPlan: (signedInUser: SignedInUser, newPlan: IConsumerPlan, nextDeliveryDate: number) => Promise<MutationConsumerRes>
  updateMyProfile: (signedInUser: SignedInUser, profile: IConsumerProfile) => Promise<MutationConsumerRes>
}

class ConsumerService implements IConsumerService {
  private readonly elastic: Client
  //@ts-ignore todo simon
  private readonly stripe: Stripe
  private planService?: IPlanService
  private orderService?: IOrderService
  private geoService?: IGeoService

  public constructor(elastic: Client, stripe: Stripe) {
    this.elastic = elastic;
    this.stripe = stripe;
  }

  public setPlanService(planService: IPlanService) {
    this.planService = planService;
  }

  public setOrderService(orderService: IOrderService) {
    this.orderService = orderService;
  }

  public setGeoService(geoService: IGeoService) {
    this.geoService = geoService;
  }

  //@ts-ignore // todo simon: redo this entire fn
  private async prepareOrdersForCancelation(signedInUser: SignedInUser) {
    // try {
    //   if (!this.orderService) throw new Error('No order service');
    //   if (!signedInUser) throw getNotSignedInErr();
    //   const stripeCustomerId = signedInUser.stripeCustomerId;
    //   if (!stripeCustomerId) throw new Error('Missing stripe customer id');

    // let pendingLineItems: Stripe.ApiList<Stripe.InvoiceItem>;
    // try {
    //   pendingLineItems = await this.stripe.invoiceItems.list({
    //     limit: 50,
    //     pending: true,
    //     customer: stripeCustomerId,
    //   });
    // } catch (e) {
    //   throw new Error(`Couldn't get future line items: ${e.stack}`)
    // }
    // const today = moment().valueOf();
    // return this.orderService.getMyUpcomingEOrders(signedInUser)
    //   .then(orders => Promise.all(orders.map(async ({ _id, order }) => {
    //     if (!this.orderService) throw new Error('OrderService not set');
    //     if (order.invoiceDate > today) {
    //       await Promise.all(pendingLineItems.data.map(line => {
    //         if (line.description && line.description.includes(moment(order.invoiceDate).format(adjustmentDateFormat))) {
    //           return this.stripe.invoiceItems.del(line.id).catch(e => {
    //             const msg = `Couldn't remove future adjustment id '${line.id}': ${e.stack}`
    //             console.error(msg);
    //             throw e;
    //           });
    //         }
    //       }));
    //       return _id;
    //     } else {
    //       return this.orderService.updateOrder(signedInUser, _id, {
    //         restId: null,
    //         meals: [],
    //         // todo 0: remove these !
    //         phone: order.consumer.profile.phone!,
    //         destination: order.consumer.profile.destination!,
    //         deliveryDate: order.deliveryDate,
    //         deliveryTime: order.deliveryTime,
    //         donationCount: order.donationCount,
    //         name: order.consumer.profile.name
    //       }).then(() => {
    //         return _id;
    //       }).catch(e => {
    //         const msg = `Failed to skip order '${_id}' for user '${signedInUser._id}': ${e.stack}`;
    //         console.error(msg)
    //         throw e;
    //       })
    //     }
    //   })))
    // } catch (e) {
    //   console.error(`[ConsumerService] failed to prepare cancelation for user '${signedInUser && signedInUser._id}'`, e.stack);
    //   throw e;
    // }
  }

  public async upsertMarketingEmail(email: string, name?: string, addr?: IAddress): Promise<MutationBoolRes> {
    try {
      let emailId = crypto.createHash('md5').update(email.toLowerCase()).digest('hex');
      const merge_fields: any = {}
      if (name) {
        const split = name.split(' ', 2);
        merge_fields.FNAME = split[0] ;
        merge_fields.LNAME = split[1];
      }

      if (addr) {
        merge_fields.ADDRESS = {
          addr1: addr.address1,
          city: addr.city,
          state: addr.state,
          zip: addr.zip,
          country: 'US',
        }
      }
      const res = await fetch(`https://${activeConfig.server.mailChimp.dataCenter}.api.mailchimp.com/3.0/lists/${activeConfig.server.mailChimp.audienceId}/members/${emailId}`, {
        headers: {
          authorization: `Basic ${Buffer.from(`anystring:${activeConfig.server.mailChimp.key}`, 'utf8').toString('base64')}`
        },
        method: 'PUT',
        body: JSON.stringify({
          email_address: email,
          status_if_new: 'subscribed',
          merge_fields,
        })
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = `Error adding marketing email '${json.detail}'`;
        console.error(msg);
        throw new Error(msg)
      }
      return {
        res: true,
        error: null
      }
    } catch (e) {
      console.error(`[ConsumerService] failed to add marketing email ${email}`, e.stack);
      throw new Error('Internal Server Error');
    }
  }

  public async cancelSubscription(
    signedInUser: SignedInUser,
    //@ts-ignore todo simon
    req?: IncomingMessage,
    //@ts-ignore todo simon
    res?: OutgoingMessage
  ) {
    try {
      if (!signedInUser) throw getNotSignedInErr()
      // const subscriptionId = signedInUser.stripeSubscriptionId;
      // if (!subscriptionId) {
      //   const msg = 'Missing stripe subscription id';
      //   console.warn('[ConsumerService]', msg)
      //   return {
      //     res: false,
      //     error: msg
      //   }
      // }
      // const p1 = this.prepareOrdersForCancelation(signedInUser)
      //   .then(orderIds => {
      //     return Promise.all(orderIds.map(id => {
      //       if (!this.orderService) throw new Error('Missing order service');
      //       return this.orderService.deleteOrder(id).catch(e => {
      //         const msg = `Failed to delete order '${id}' from for user '${signedInUser._id}'. ${e.stack}`;
      //         console.error(msg)
      //         throw e;
      //       })
      //     }))
      //   })
      //   .then(() => {
      //     return this.stripe.subscriptions.del(subscriptionId, { invoice_now: true })
      //       .catch(e => {
      //         const msg = `Failed to delete subscription '${subscriptionId}' from stripe for user '${signedInUser._id}'. ${e.stack}`;
      //         console.error(msg)
      //         throw e;
      //       });
      //   })
      //   .catch(e => {
      //     const msg = `Failed to get prepareOrders for cancelation for user '${signedInUser._id}'`;
      //     console.error(msg)
      //     throw e;
      //   });

      // const p2 = fetch(`https://${activeConfig.server.auth.domain}/api/v2/users/${signedInUser._id}`, {
      //   headers: await getAuth0Header(),
      //   method: 'PATCH',
      //   body: JSON.stringify({
      //     app_metadata: {
      //       stripeSubscriptionId: null,
      //     },
      //   })
      // }).then(async () => {
      //   if (req && res) await refetchAccessToken(req, res);
      // }).catch(e => {
      //   const msg = `Failed to remove stripeSubscriptionId from auth0 for user '${signedInUser._id}'. ${e.stack}`;
      //   console.error(msg)
      //   throw e;
      // });
      // const updatedConsumer: Omit<EConsumer, 'createdDate' | 'profile' | 'stripeCustomerId'> = {
      //   stripeSubscriptionId: null,
      //   plan: null,
      // }
      // const p3 = this.elastic.update({
      //   index: CONSUMER_INDEX,
      //   id: signedInUser._id,
      //   body: {
      //     doc: updatedConsumer
      //   }
      // }).catch(e => {
      //   const msg = `Failed to remove stripeSubscriptionId from elastic for user '${signedInUser._id}'. ${e.stack}`;
      //   console.error(msg)
      //   throw e;
      // });

      // await Promise.all([p1, p2, p3]);
      return {
        res: true,
        error: null,
      };
    } catch (e) {
      console.error(`[ConsumerService] couldn't cancel subscription for user '${JSON.stringify(signedInUser)}'`, e.stack);
      throw new Error('Internal Server Error');
    }
  }

  public async insertConsumer(_id: string, name: string, email: string): Promise<IConsumer> {
    try {
      if (!this.planService) throw new Error('PlanService not set');
      let res: ApiResponse<SearchResponse<any>>
      try {
        res = await this.elastic.search({
          index: CONSUMER_INDEX,
          size: 1000,
          _source: 'false',
          body: {
            query: {
              ids: {
                values: _id
              }
            }
          }
        });
      } catch (e) {
        console.error(`[ConsumerService] Couldn't search for consumer ${_id}. ${e.stack}`);
        throw e;
      }
      if (res.body.hits.total.value > 0) throw new Error(`Consumer with id '_id' ${_id} already exists`);
      const body: EConsumer = {
        createdDate: Date.now(),
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        profile: {
          name,
          email,
          phone: null,
          card: null,
          destination: null,
        },
        plan: null,
      }
      await this.elastic.index({
        index: CONSUMER_INDEX,
        id: _id,
        refresh: 'true', 
        body
      });
      return Consumer.getIConsumerFromEConsumer(_id, body);
    } catch (e) {
      console.error(`[ConsumerService] couldn't insert consumer '${_id}'`, e.stack);
      throw e;
    }
  }

  async getConsumer(_id: string): Promise<IConsumer | null> {
    try {
      const consumer: ApiResponse<EConsumer> = await this.elastic.getSource(
        {
          index: CONSUMER_INDEX,
          id: _id,
        },
        { ignore: [404] }
      );
      if (consumer.statusCode === 404) return null;
      return {
        _id,
        stripeCustomerId: consumer.body.stripeCustomerId,
        stripeSubscriptionId: consumer.body.stripeSubscriptionId,
        profile: consumer.body.profile,
        plan: consumer.body.plan
      }
    } catch (e) {
      console.error(`[ConsumerService] Failed to get consumer ${_id}: ${e.stack}`)
      return null;
    }
  }

  async getConsumerByStripeId(stripeCustomerId: string): Promise<IConsumer> {
    try {
      const res: ApiResponse<SearchResponse<EConsumer>> = await this.elastic.search({
        index: CONSUMER_INDEX,
        size: 1000,
        body: {
          query: {
            bool: {
              filter: {
                term: {
                  stripeCustomerId
                }
              }
            }
          }
        }
      });
      if (res.body.hits.total.value === 0) throw new Error(`Consumer with stripeId '${stripeCustomerId}' not found`);
      const consumer = res.body.hits.hits[0];
      return Consumer.getIConsumerFromEConsumer(consumer._id, consumer._source);
    } catch (e) {
      console.error(`Failed to search for consumer stripeCustomerId ${stripeCustomerId}: ${e.stack}`);
      throw new Error('Internal Server Error');
    }
  }

  async signUp(email: string, name: string, pass: string, res?: OutgoingMessage) {
    try {
      if (!res) throw new Error('Res is undefined');
      const signedUp = await manualAuthSignUp(email, name, pass, res);
      if (signedUp.res === null || signedUp.error) {
        return {
          res: null,
          error: signedUp.error,
        }
      }
      const consumer = await this.insertConsumer(signedUp.res._id, signedUp.res.profile.name,  signedUp.res.profile.email)
      this.upsertMarketingEmail(email, name).catch(e => {
        console.error(`[ConsumerService] failed to upsert marketing email '${email}' with name '${name}'`, e.stack);
      });
      return {
        res: consumer,
        error: null,
      }
    } catch (e) {
      console.error(`[ConsumerService] failed to signup '${email}'`, e.stack);
      throw new Error('Internal Server Error');
    }
  }

  public async updateAuth0MetaData(userId: string, stripeSubscriptionId: string, stripeCustomerId: string): Promise<Response> {
    return fetch(`https://${activeConfig.server.auth.domain}/api/v2/users/${userId}`, {
      headers: await getAuth0Header(),
      method: 'PATCH',
      body: JSON.stringify({
        app_metadata: {
          stripeSubscriptionId,
          stripeCustomerId,
        },
      })
    }).catch(e => {
      const msg = `[ConsumerService] couldn't add stripeSubscriptionId for user '${userId}'`
      console.error(msg, e.stack);
      throw e;
    });
  }

  async upsertConsumer(_id: string, consumer: EConsumer): Promise<IConsumer> {
    // todo: when inserting, make sure check for existing consumer with email only and remove it to prevent
    // dupe entries.
    try {
      await this.elastic.index({
        index: CONSUMER_INDEX,
        id: _id,
        body: consumer
      });
      return {
        _id,
        ...consumer
      }
    } catch (e) {
      console.error(`[ConsumerService] failed to upsert consumer '${_id}', '${JSON.stringify(consumer)}'`, e.stack);
      throw e;
    }
  }

  async updateMyProfile (signedInUser: SignedInUser, profile: IConsumerProfile): Promise<MutationConsumerRes> {
    try {
      if (!this.geoService) return Promise.reject('GeoService not set');
      if (!signedInUser) throw getNotSignedInErr();
      if (!profile.destination) throw new Error('Missing destination');
      if (!this.orderService) throw new Error('Order service not set');
      const {
        address1,
        city,
        state,
        zip
      } = profile.destination.address;
      try {
        await this.geoService.getGeocode(address1, city, state, zip);
      } catch (e) {
        return {
          res: null,
          error: `Couldn't verify address '${address1} ${city} ${state}, ${zip}'`
        }
      }
      const res = await this.elastic.update({
          index: CONSUMER_INDEX,
          id: signedInUser._id,
          _source: 'true',
          body: {
            doc: {
              profile,
            }
          }
        });
      const newConsumer = {
        _id: signedInUser._id,
        ...res.body.get._source
      };
      await this.orderService.updateUpcomingOrdersProfile(signedInUser, profile);
      this.upsertMarketingEmail(signedInUser.profile.email, profile.name, profile.destination.address).catch(e => {
        console.error(`[ConsumerService] failed to upsert marketing email for email '${signedInUser.profile.email}'`, e.stack)
      });
      return {
        res: newConsumer,
        error: null
      }
    } catch (e) {
      console.error(`[ConsumerService] failed to update consumer profile for '${signedInUser?._id}'`, e.stack);
      throw new Error('Internal Server Error');
    }
  }

  //@ts-ignore
  async updateMyPlan(signedInUser: SignedInUser, newPlan: IConsumerPlan, nextDeliveryDate: number): Promise<MutationConsumerRes> {
    //todo simon: redo this fn
    //   try {
  //     if (!signedInUser) throw getNotSignedInErr()
  //     if (!this.orderService) throw new Error('OrderService not set');
  //     if (!this.planService) throw new Error('PlanService not set');
  //     if (!signedInUser.stripeSubscriptionId) throw new Error('No stripeSubscriptionId');
  //     let newConsumer: IConsumer;
  //     try {
  //       const res = await this.elastic.update({
  //         index: CONSUMER_INDEX,
  //         id: signedInUser._id,
  //         _source: 'true',
  //         body: {
  //           doc: {
  //             plan: newPlan,
  //           }
  //         }
  //       });
  //       newConsumer = {
  //         _id: signedInUser._id,
  //         ...res.body.get._source
  //       };
  //     } catch (e) {
  //       const msg = `Failed to update elastic consumer plan for consumer '${signedInUser._id}' to plan ${JSON.stringify(newPlan)}: ${e.stack}`;
  //       console.error(msg)
  //       throw e;
  //     }
  //     let mealPrice;
  //     let total;
  //     let mealCount;
  //     try {
  //       const plan = await this.planService.getPlan(newPlan.stripePlanId);
  //       if (!plan) throw new Error (`No plan found with id '${newPlan.stripePlanId}'`);
  //       mealPrice = plan.mealPrice;
  //       total = plan.weekPrice;
  //       mealCount = plan.mealCount;
  //     } catch (e) {
  //       console.error(`Failed to getPlan with id '${newPlan.stripePlanId}': ${e.stack}`);
  //       throw e;
  //     }

  // const canceler = this.prepareOrdersForCancelation(signedInUser).catch(e => {
  //   console.error(`Failed to prepareOrdersForCancelation '${signedInUser && signedInUser._id}': ${e.stack}`);
  //   throw e;
  // });

  // const subscription = this.stripe.subscriptions.retrieve(signedInUser.stripeSubscriptionId).catch(e => {
  //   throw new Error(`Failed to retreive subscription for consumer '${signedInUser.stripeSubscriptionId}': ${e.stack}`);
  // });

  // const res = await Promise.all([canceler, subscription])

  // const updateUpcoming = this.orderService.updateUpcomingOrdersPlans(
  //   signedInUser, 
  //   mealPrice,
  //   total,
  //   mealCount,
  //   newPlan,
  //   nextDeliveryDate,
  // ).catch(e => {
  //   console.error(`Failed to updateUpcomingOrders for consumer '${signedInUser && signedInUser._id}': ${e.stack}`);
  //   throw e;
  // });

  // const newInvoiceDateSeconds = Math.round(moment(nextDeliveryDate).subtract(2, 'd').valueOf() / 1000)
  // const updateSubscription = this.stripe.subscriptions.update(signedInUser.stripeSubscriptionId, {
  //   trial_end: newInvoiceDateSeconds,
  //   proration_behavior: 'none',
  //   items: [{
  //     id: res[1].items.data[0].id,
  //     plan: newPlan.stripePlanId,
  //   }]
  // }).catch(e => {
  //   console.error(`Failed to update subscription for consumer '${signedInUser && signedInUser._id}': ${e.stack}`);
  //   throw e;
  // });

  //     await Promise.all([updateUpcoming, updateSubscription])
  //     return {
  //       res: newConsumer,
  //       error: null,
  //     }
  //   } catch (e) {
  //     console.error(`
  //       [ConsumerService] Failed to update plan for user '${signedInUser && signedInUser._id}' with plan '${JSON.stringify(newPlan)}'`,
  //       e.stack
  //     );
  //     throw new Error('Internal Server Error');
  //   }
  }
}

let consumerService: ConsumerService;

export const initConsumerService = (
  elastic: Client,
  stripe: Stripe,
) => {
  if (consumerService) throw new Error('[ConsumerService] already initialized.');
  consumerService = new ConsumerService(elastic, stripe);
  return consumerService;
};

export const getConsumerService = () => {
  if (consumerService) return consumerService;
  initConsumerService(
    initElastic(),
    new Stripe(activeConfig.server.stripe.key, {
      apiVersion: '2020-03-02',
    }),
  );
  //@ts-ignore
  consumerService!.setOrderService(getOrderService());
  consumerService!.setPlanService(getPlanService());
  consumerService!.setGeoService(getGeoService());
  return consumerService;
}
