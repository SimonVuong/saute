import gql from 'graphql-tag';

const restFragment = gql`
  fragment restFragment on Rest {
    _id
    location {
      address {
        address1
        address2
        city
        state
        zip
      }
    }
    menu {
      _id
      img
      name
      description
      originalPrice
      stripePlanId
      planName
      tags
      addonGroups {
        names
        limit
      }
      optionGroups {
        names
      }
    }
    profile {
      name
      phone
    }
    taxRate
  }
`

export {
  restFragment,
}