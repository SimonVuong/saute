import gql from 'graphql-tag';

const _ConsumerQL = gql`
  type Consumer {
    userId: ID!
    plan: ConsumerPlan!
    card: Card!
    phone: String!
    destination: Destination!
  }
`

export const ConsumerQL = () => [
  _ConsumerQL,
]