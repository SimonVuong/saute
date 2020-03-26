import { Cart } from '../../order/cartModel';
import { analyticsService, events } from "../utils/analyticsService";

export const sendCartMenuMetrics = (
  stripePlanId: string,
  cart: Cart,
  restName: string,
  mealPrice: number,
  mealCount: number,
) => {
  analyticsService.trackEvent(events.FILLED_CART, {
    count: mealCount,
    stripePlanId,
    restId: cart.RestId,
    restName,
    mealPrice,
  });
  cart.Meals.forEach(meal => {
    for (let i = 0; i < meal.Quantity; i++) {
      analyticsService.trackEvent(events.FILLED_CART_MEALS, {
        name: meal.Name,
        mealId: meal.MealId,
      });
    }
  });
}

export const sendZipMetrics = (
  zip: string
) => {
  analyticsService.trackEvent(events.ENTERED_ZIP, {
    zip
  });
}