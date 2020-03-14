import { gql } from 'apollo-server';

export const CartMealQL = gql`
  type CartMeal {
    mealId: ID!
    img: String!
    name: String!
    quantity: Int!
  }

  input CartMealInput {
    mealId: ID!
    img: String!
    name: String!
    quantity: Int!
  }
`

export const OrderStatus = gql`
  enum OrderStatus {
    Complete
    Confirmed
    Open
    Returned
    Skipped
  }
`

export const _OrderQL = gql`
  input CartInput {
    restId: ID!
    consumerPlan: ConsumerPlanInput!
    paymentMethodId: String!
    card: CardInput!
    meals: [CartMealInput!]!
    phone: String!
    destination: DestinationInput!
    deliveryDate: Float!
  }
  input UpdateOrderInput {
    restId: ID!
    stripePlanId: ID #null for skip order
    meals: [CartMealInput!]!
    phone: String!
    destination: DestinationInput!
    deliveryDate: Float!
  }
  type Order {
    _id: ID!
    deliveryDate: Float!
    destination: Destination!
    mealPrice: Float
    meals: [CartMeal!]!
    phone: String!
    rest: Rest!
    status: OrderStatus!
  }
`;


export const OrderQL = () => [
  CartMealQL,
  OrderStatus,
  _OrderQL,
]

