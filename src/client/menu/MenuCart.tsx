import { useGetCart, useIncrementCartDonationCount, useDecrementCartDonationCount } from "../global/state/cartState";
import { useGetAvailablePlans } from "../../plan/planService";
import withClientApollo from "../utils/withClientApollo";
import { Cart } from "../../order/cartModel";
import Router, { useRouter } from 'next/router'
// import { sendCartMenuMetrics } from "./menuMetrics";
import { upcomingDeliveriesRoute } from "../../pages/consumer/upcoming-deliveries";
import { deliveryRoute } from "../../pages/delivery";
import { useGetConsumer } from "../../consumer/consumerService";
import { Tier, MIN_MEALS, PlanTypes } from "../../plan/planModel";

export const getSuggestion = (cart: Cart | null, minMeals: number) => {
  if (!cart) return [];
  let suggestion: string[] = [];
  Object.entries(cart.RestMeals).forEach(([_restId, restMeals]) => {
    if (restMeals.mealCount < minMeals) {
      suggestion.push(`${restMeals.mealCount}/${minMeals} for ${restMeals.meals[0].RestName}`);
    }
  });
  return suggestion;
}

const MenuCart: React.FC<{
  render: (
    cart: Cart | null,
    disabled: boolean | undefined,
    onNext: () => void,
    suggestions: string[],
    summary: string,
    donationCount: number,
    incrementDonationCount: () => void,
    decremetnDonationCount: () => void,
  ) => React.ReactNode
}> = ({
  render
}) => {
  const cart = useGetCart();
  const plans = useGetAvailablePlans();
  const consumer = useGetConsumer();
  const updatingParam = useRouter().query.updating;
  const isUpdating = !!updatingParam && updatingParam === 'true'
  const donationCount = cart ? cart.DonationCount : 0;
  const upcomingDeliveriesPath = {
    pathname: upcomingDeliveriesRoute,
    query: { updating: 'true' }
  }
  const onNext = () => {
    if (!plans.data) {
      const err = new Error('Missing plans');
      console.error(err.stack);
      throw err;
    }
    if (!cart) {
      const err = new Error('Missing cart');
      console.error(err.stack);
      throw err;
    }
    if (isUpdating) {
      Router.push(upcomingDeliveriesPath);
    } else {
      if (consumer && consumer.data && consumer.data.StripeSubscriptionId) {
        Router.push(upcomingDeliveriesPath);
      } else {
        Router.push(deliveryRoute);
      }
    }
    // todo simon enable metrics
    // sendCartMenuMetrics(
    //   cart,
    //   cart && cart.RestName ? cart.RestName : null,
    //   Plan.getMealPrice(stripePlanId, sortedPlans.data),
    //   Plan.getPlanCount(stripePlanId, sortedPlans.data),
    // );
  }
  const incrementDonationCount = useIncrementCartDonationCount();
  const decrementDonationCount = useDecrementCartDonationCount();

  const disabled = false;
  const mealCount = cart ? cart.getStandardMealCount() : 0;
  let summary = '';
  let suggestions: string[] = [];
  if (plans.data) {
    if (mealCount >= MIN_MEALS) {
      const moreToNext = Tier.getCountTillNextPlan(PlanTypes.Standard, mealCount, plans.data);
      const nextPrice = Tier.getNextMealPrice(PlanTypes.Standard, mealCount, plans.data);
      const next = moreToNext && nextPrice ? ` +${moreToNext} for ${(nextPrice / 100).toFixed(2)} ea` : ''
      summary = `${mealCount} meals plan (${(Tier.getMealPrice(PlanTypes.Standard, mealCount, plans.data) / 100).toFixed(2)} ea).${next}`
    }
    suggestions = getSuggestion(cart, MIN_MEALS);
  }
  return (
    <>
      {render(
        cart,
        disabled,
        onNext,
        suggestions,
        summary,
        donationCount,
        incrementDonationCount,
        decrementDonationCount,
      )}
    </>
  );
}

export default withClientApollo(MenuCart);