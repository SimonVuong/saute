import { IDiscount } from './discountModel';
import { PlanName, PlanNames, IPlan, Tier } from './../plan/planModel';
import { IDelivery, Delivery, IDeliveryInput, EDelivery } from './deliveryModel';
import moment from 'moment';
import { IDestination, Destination } from './../place/destinationModel';
import { EConsumerProfile, EConsumer, IMealPlan, EMealPlan } from './../consumer/consumerModel';
import { ICost, Cost } from './costModel';
import { IPromo } from './promoModel';

export interface EOrder {
  readonly cartUpdatedDate: number
  readonly consumer: {
    readonly userId: string
    readonly profile: EConsumerProfile
  },
  readonly costs: ICost
  readonly createdDate: number
  readonly invoiceDate: number
  readonly plans: EMealPlan[]
  readonly stripeInvoiceId?: string,
  readonly deliveries: IDelivery[]
  readonly stripeSubscriptionId: string
  readonly donationCount: number
}

export interface IMealPrice {
  readonly stripePlanId: string
  readonly planName: PlanName
  readonly mealPrice: number
}

export class MealPrice implements IMealPrice {
  readonly stripePlanId: string
  readonly planName: PlanName
  readonly mealPrice: number

  constructor(mp: IMealPrice) {
    this.stripePlanId = mp.stripePlanId;
    this.planName = mp.planName;
    this.mealPrice = mp.mealPrice;
  }

  public get StripePlanId() { return this.stripePlanId }
  public get PlanName() { return this.planName }
  public get MealPrice() { return this.mealPrice }

  public static getMealPrices(mealPlans: IMealPlan[], plans: IPlan[]) {
    return mealPlans.reduce<IMealPrice[]>((mealPrices, mp) => [
      ...mealPrices,
      {
        stripePlanId: mp.stripePlanId,
        planName: mp.planName,
        mealPrice: Tier.getMealPrice(
          mp.planName,
          mp.mealCount,
          plans
        )
      }
    ], []);
  }

  public static getICopy(mp: IMealPrice) {
    return {
      stripePlanId: mp.stripePlanId,
      planName: mp.planName,
      mealPrice: mp.mealPrice
    }
  }

  public static getMealPriceFromDeliveries(
    plans: IPlan[],
    newDeliveries: IDeliveryInput[],
    donationCount: number
  ): IMealPrice[] {
    type mealCounts = {
      [key: string]: {
        stripePlanId: string
        planName: PlanName
        quantity: number
      }
    }
    const standardPlan = plans.find(p => p.name === PlanNames.Standard);
    if (!standardPlan) throw new Error(`Missing ${PlanNames.Standard} plan from plans ${JSON.stringify(plans)}`)
    const intialMealCounts: mealCounts = donationCount > 0 ?
      {
        [standardPlan.stripePlanId]: {
          stripePlanId: standardPlan.stripePlanId,
          planName: PlanNames.Standard,
          quantity: donationCount
        }
      }
    :
      {}
 
    const mealCounts = newDeliveries.reduce<mealCounts>((counts, d) => {
      return d.meals.reduce((counts, m) => {
        if (counts[m.stripePlanId]) {
          counts[m.stripePlanId] = {
            stripePlanId: m.stripePlanId,
            planName: m.planName,
            quantity: counts[m.stripePlanId].quantity + m.quantity,
          }
        } else {
          counts[m.stripePlanId] = {
            stripePlanId: m.stripePlanId,
            planName: m.planName,
            quantity: m.quantity,
          }
        }
        return counts;
      }, counts)
    }, intialMealCounts);
    return Object.values(mealCounts).reduce<IMealPrice[]>((sum, c) => [
      ...sum,
      {
        stripePlanId: c.stripePlanId,
        planName: c.planName,
        mealPrice: Tier.getMealPrice(
          c.planName,
          c.quantity,
          plans
        )
      }
    ], []);
  }
}

export interface IOrder {
  readonly _id: string
  readonly invoiceDate: number
  readonly isAutoGenerated: boolean,
  readonly deliveries: IDelivery[]
  // destination will be removed when we support a desitnation per delivery
  readonly destination: IDestination
  readonly costs: ICost
  readonly phone: string
  readonly name: string
  readonly donationCount: number
  readonly stripeInvoiceId: string | null
}

export class Order implements IOrder{
  readonly _id: string
  readonly invoiceDate: number
  readonly isAutoGenerated: boolean
  readonly deliveries: Delivery[]
  readonly destination: Destination
  readonly costs: Cost
  readonly phone: string
  readonly name: string
  readonly donationCount: number
  readonly stripeInvoiceId: string | null

  constructor(order: IOrder) {
    this._id = order._id;
    this.invoiceDate = order.invoiceDate;
    this.isAutoGenerated = order.isAutoGenerated;
    this.deliveries = order.deliveries.map(d => new Delivery(d))
    this.destination = new Destination(order.destination);
    this.costs = new Cost(order.costs);
    this.phone = order.phone;
    this.name = order.name;
    this.donationCount = order.donationCount;
    this.stripeInvoiceId = order.stripeInvoiceId;
  }

  public get Id() { return this._id }
  public get InvoiceDate() { return this.invoiceDate }
  public get IsAutoGenerated() { return this.isAutoGenerated }
  public get Deliveries() { return this.deliveries }
  public get Destination() { return this.destination }
  public get Costs() { return this.costs }
  public get Phone() { return this.phone }
  public get DonationCount() { return this.donationCount }
  public get Name() { return this.name }
  public get StripeInvoiceId() { return this.stripeInvoiceId }

  static getMealCount(order: IOrder, planName: PlanName,) {
    const totalMeals = order.deliveries.reduce((sum, delivery) => {
      return sum + delivery.meals.reduce((innerSum, m) => (
        m.planName === planName ? innerSum + m.quantity : innerSum
      ), 0);
    }, 0);

    if (planName === PlanNames.Standard) return totalMeals + order.donationCount;
  }

  static addTypenames(order: IOrder) {
    //@ts-ignore
    order.destination.address.__typename = 'Address';
    //@ts-ignore
    order.destination.__typename = 'Destination';
    order.deliveries.forEach(d => {
      //@ts-ignore
      d.__typename = 'Delivery';
      //@ts-ignore
      d.meals.forEach(m => m.__typename = 'DeliveryMeal');
    });
    // @ts-ignore
    order.costs.__typename = 'Costs';
    order.costs.mealPrices.forEach(mp => {
      //@ts-ignore
      mp.__typename = 'MealPrice';
    });
    order.costs.discounts.forEach(d => {
      //@ts-ignore
      d.__typename = 'Discount';
    });
    order.costs.promos.forEach(p => {
      //@ts-ignore
      p.__typename = 'Promo';
    });
    //@ts-ignore
    order.__typename = 'Order';
    return order;
  }


  static getICopy(order: IOrder): IOrder {
    return {
      _id: order._id,
      invoiceDate: order.invoiceDate,
      isAutoGenerated: order.isAutoGenerated,
      deliveries: order.deliveries.map(d => Delivery.getICopy(d)),
      destination: Destination.getICopy(order.destination),
      costs: Cost.getICopy(order.costs),
      phone: order.phone,
      name: order.name,
      donationCount: order.donationCount,
      stripeInvoiceId: order.stripeInvoiceId,
    }
  }

  static getIOrderFromEOrder(_id: string, order: EOrder): IOrder {
    return {
      _id,
      invoiceDate: order.invoiceDate,
      isAutoGenerated: order.cartUpdatedDate === order.createdDate,
      deliveries: order.deliveries,
      destination: order.consumer.profile.destination!,
      costs: order.costs,
      phone: order.consumer.profile.phone!,
      name: order.consumer.profile.name,
      donationCount: order.donationCount,
      stripeInvoiceId: order.stripeInvoiceId || null,
    }
  }

  static getNewOrder(
    consumerId: string,
    consumer: EConsumer,
    deliveries: IDeliveryInput[],
    donationCount: number,
    invoiceDate: number,
    mealPrices: IMealPrice[],
    promos: IPromo[],
    discounts: IDiscount[],
    createdDate?: number,
    updatedDate?: number,
  ): EOrder {
    if (!consumer.stripeSubscriptionId) {
      const err = new Error('Missing subscription id');
      console.error(err.stack);
      throw err;
    }
    if (!consumer.plan) {
      const err = new Error('Missing plan');
      console.error(err.stack);
      throw err;
    }
    const plans = consumer.plan.mealPlans;
    const now = moment();
    return {
      consumer: {
        userId: consumerId,
        profile: consumer.profile
      },
      stripeSubscriptionId: consumer.stripeSubscriptionId,
      cartUpdatedDate: updatedDate || now.valueOf(),
      createdDate: createdDate || now.valueOf(),
      invoiceDate,
      costs: {
        tax: Cost.getTaxes(deliveries, mealPrices),
        tip: 0,
        mealPrices,
        promos,
        discounts,
        percentFee: 0,
        flatRateFee: 0,
        deliveryFee: Cost.getDeliveryFee(deliveries),
      },
      plans,
      deliveries: deliveries.map<EDelivery>(delivery => ({
        ...delivery,
        meals: delivery.meals.map(m => {
          const plan = plans.find(mp => mp.stripePlanId === m.stripePlanId);
          if (!plan) {
            const err = new Error(`Missing order plan for stripePlanId ${m.stripePlanId}`);
            console.error(err);
            throw err;
          }
          return {
            ...m,
            stripeSubscriptionItemId: plan.stripeSubscriptionItemId
          }
        }),
        status: 'Open'
      })),
      donationCount,
    }
  }
}