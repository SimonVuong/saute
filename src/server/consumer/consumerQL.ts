import gql from 'graphql-tag';

const _ConsumerQL = gql`
  type ConsumerRes {
    res: Consumer
    error: String
  }
  type Consumer {
    _id: ID!
    plan: ConsumerPlan!
    profile: ConsumerProfile!
    stripeCustomerId: ID
    stripeSubscriptionId: ID
  }
  type ConsumerProfile {
    name: String!
    email: String!
    card: Card
    phone: String
    destination: Destination
  }
`

export const ConsumerQL = () => [
  _ConsumerQL,
]