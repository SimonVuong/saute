import { gql } from 'apollo-server';

export const _OrderQL = gql`
  enum DeliveryStatus {
    Complete
    Confirmed
    Open
    Returned
    Skipped
  }

  input CartInput {
    card: CardInput!
    consumerPlan: ConsumerPlanInput!
    donationCount: Int!
    deliveries: [DeliveryInput!]!
    destination: DestinationInput!
    paymentMethodId: String!
    phone: String!
    promo: String
  }

  input DeliveryInput {
    deliveryTime: DeliveryTime!
    deliveryDate: Float!
    discount: Int
    meals: [DeliveryMealInput!]!
  }

  input DeliveryMealInput {
    mealId: ID!
    img: String
    name: String!
    quantity: Int!
    restId: ID!
    choices: [String!]!
    restName: String!
    hours: HoursInput!
    stripePlanId: ID!
    planName: ID!
    taxRate: Float!
    tags: [TagInput!]!
  }

  input UpdateDeliveryInput { 
    deliveries: [DeliveryInput!]!
    donationCount: Int!
  }

  type Discount {
    description: String!
    amountOff: Int
    percentOff: Int
    reason: String!
    referredUserId: String
  }

  type DeliveryMeal {
    mealId: ID!
    img: String
    name: String!
    choices: [String!]!
    quantity: Int!
    restId: ID!
    restName: String!
    hours: Hours!
    stripePlanId: ID!
    planName: ID!
    taxRate: Float!
    tags: [Tag!]!
  }

  type Delivery {
    deliveryTime: DeliveryTime!
    deliveryDate: Float!
    discount: Int
    meals: [DeliveryMeal!]!
    status: DeliveryStatus!
  }

  type MealPrice {
    stripePlanId: ID!
    planName: ID!
    mealPrice: Float!
  }

  type Promo {
    stripeCouponId: ID!
    percentOff: Int
    amountOff: Int
    duration: String
  }

  type Costs {
    tax: Float!
    tip: Float!
    mealPrices: [MealPrice!]!
    promos: [Promo!]!
    discounts: [Discount!]!
    percentFee: Float
    flatRateFee: Float
    deliveryFee: Float!
  }

  type Spent {
    amount: Int!
    numMeals: Int!
    numOrders: Int!
  }

  type Rewards {
    earned: Int!
    potential: Int!
  }

  type PromoRes {
    res: Promo
    error: String
  }

  type Order {
    _id: ID!
    invoiceDate: Float!
    isAutoGenerated: Boolean!
    deliveries: [Delivery!]!
    costs: Costs!
    phone: String!
    name: String!
    donationCount:Int!
    destination: Destination
    stripeInvoiceId: String
  }
`;


export const OrderQL = () => [
  _OrderQL,
]

