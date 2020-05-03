import { PlanName } from './../plan/planModel';
import { IMeal } from './../rest/mealModel';
import { deliveryTime } from './../consumer/consumerModel';

type DeliveryStatus = 'Complete' | 'Confirmed' | 'Open' | 'Returned' | 'Skipped' | 'Canceled';
 
export interface IDeliveryMeal extends Omit<IMeal, '_id' | 'description' | 'originalPrice'>{
  readonly mealId: string
  readonly quantity: number
  readonly restId: string
  readonly restName: string
  readonly taxRate: number
}

export interface IUpdateDeliveryInput {
  readonly donationCount: number
  readonly deliveries: IDeliveryInput[]
}

export class DeliveryMeal implements IDeliveryMeal {
  readonly mealId: string;
  readonly img?: string;
  readonly name: string;
  readonly quantity: number
  readonly restId: string
  readonly restName: string
  readonly stripePlanId: string;
  readonly planName: PlanName;
  readonly taxRate: number

  constructor(meal: IDeliveryMeal) {
    this.mealId = meal.mealId;
    this.img = meal.img;
    this.name = meal.name;
    this.quantity = meal.quantity;
    this.restId = meal.restId;
    this.restName = meal.restName;
    this.stripePlanId = meal.stripePlanId;
    this.planName = meal.planName;
    this.taxRate = meal.taxRate;
  }

  public get MealId() { return this.mealId }
  public get Img() { return this.img }
  public get Name() { return this.name }
  public get Quantity() { return this.quantity }
  public get RestId() { return this.restId }
  public get RestName() { return this.restName }
  public get StripePlanId() { return this.stripePlanId }
  public get PlanName() { return this.planName }
  public get TaxRate() { return this.taxRate }

  static getDeliveryMeal(
    meal: IMeal,
    restId: string,
    restName: string,
    taxRate: number,
    quantity: number = 1
  ) {
    return new DeliveryMeal({
      mealId: meal._id,
      img: meal.img,
      name: meal.name,
      quantity,
      restId,
      restName,
      stripePlanId: meal.stripePlanId,
      planName: meal.planName,
      taxRate,
    });
  }

  public equals(meal: DeliveryMeal) {
    if (this.MealId !== meal.MealId) return false;
    if (this.Img !== meal.Img) return false;
    if (this.Name !== meal.Name) return false;
    if (this.Quantity !== meal.Quantity) return false;
    if (this.RestId !== meal.RestId) return false;
    if (this.RestName !== meal.RestName) return false;
    return true;
  }

  static getICopy(meal: IDeliveryMeal): IDeliveryMeal {
    return {
      ...meal
    }
  }
}

export interface IDeliveryInput {
  readonly deliveryTime: deliveryTime
  readonly deliveryDate: number;
  // eventually we can support mulitple destinations
  // readonly destination: IDestination | null;
  readonly discount: number | null
  readonly meals: IDeliveryMeal[]
}

export class DeliveryInput implements IDeliveryInput {
  readonly deliveryTime: deliveryTime
  readonly deliveryDate: number
  readonly discount: number | null
  readonly meals: DeliveryMeal[]

  constructor(delivery: IDeliveryInput) {
    this.deliveryDate = delivery.deliveryDate;
    this.discount = delivery.discount;
    this.meals = delivery.meals.map(m => new DeliveryMeal(m));
    this.deliveryTime = delivery.deliveryTime;
  }

  public get DeliveryTime() { return this.deliveryTime }
  public get DeliveryDate() { return this.deliveryDate }
  public get Discount() { return this.discount }
  public get Meals() { return this.meals }

  static getICopy(d: IDeliveryInput): IDeliveryInput {
    return {
      ...d,
      meals: d.meals.map(m => DeliveryMeal.getICopy(m)),
    }
  }

  static getMealCount(deliveryInputs: IDeliveryInput[]) {
    return deliveryInputs.reduce<number>(
      (sum, deliveryInput) => sum + deliveryInput.meals.reduce<number>(
        (innerSum, meal) => innerSum + meal.quantity, 0
      ),
      0)
  }
}

export interface IDelivery extends IDeliveryInput {
  readonly status: DeliveryStatus
}

export class Delivery extends DeliveryInput implements IDelivery {
  readonly status: DeliveryStatus
  
  constructor(delivery: IDelivery) {
    super(delivery);
    this.status = delivery.status;
  }

  public get Status() { return this.status }

  static getICopy(d: IDelivery): IDelivery {
    return {
      ...DeliveryInput.getICopy(d),
      status: d.status,
    }
  }

  static getConfirmedMealCount(deliveries: IDelivery[]): confirmedMealCounts {
    return deliveries.reduce<confirmedMealCounts>((sum, d) => {
      d.meals.forEach(m => {
        if (sum[m.stripePlanId]) {
          sum[m.stripePlanId] += m.quantity;
        } else {
          sum[m.stripePlanId] = m.quantity
        }
      });
      return sum;
    }, {});
  }
}

type confirmedMealCounts = {
  [key: string]: number
}
