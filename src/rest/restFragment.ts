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
      tags {
        type
        name
      }
      isActive
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
      actor
      actorImg
      story
    }
    taxRate
  }
`

export {
  restFragment,
}