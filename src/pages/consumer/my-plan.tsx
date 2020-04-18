import { makeStyles, Typography, Container, Paper, Button} from "@material-ui/core";
import { useRef, useState } from 'react';
import { CuisineType, ConsumerPlan } from '../../consumer/consumerModel';
// import PlanCards from '../../client/plan/PlanCards';
import RenewalChooser from '../../client/general/RenewalChooser';
import { useRequireConsumer, useCancelSubscription, useUpdateMyPlan } from "../../consumer/consumerService";
import withApollo from "../../client/utils/withPageApollo";
import { useMutationResponseHandler } from "../../utils/apolloUtils";
import Notifier from "../../client/notification/Notifier";
// import { useUpdateCartPlanId } from "../../client/global/state/cartState";
import { useNotify } from "../../client/global/state/notificationState";
import { NotificationType } from "../../client/notification/notificationModel";
import { useGetAvailablePlans } from "../../plan/planService";
import { sendChooseCuisineMetrics } from "../../client/consumer/myPlanMetrics";
import Counter from "../../client/menu/Counter";
import AddIcon from '@material-ui/icons/Add';
import RemoveIcon from '@material-ui/icons/Remove';

const useStyles = makeStyles(theme => ({
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'left',
    background: 'none',
    paddingBottom: theme.spacing(4),
  },
  button: {
    borderRadius: 10,
  },
  minusButton: {
    backgroundColor: `${theme.palette.grey[600]}`,
    '&:hover': {
      backgroundColor: theme.palette.grey[800],
    },
    '&:disabled': {
      backgroundColor: theme.palette.grey[300],
    },
  },
  paperContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'left',
    marginTop: theme.spacing(3),
    paddingBottom: theme.spacing(4),
    paddingLeft: theme.spacing(4),
    paddingRight: theme.spacing(4),
  },
  verticalPadding: {
    paddingBottom: theme.spacing(2),
    paddingTop: theme.spacing(2),
  },
  cancel: {
    marginTop: theme.spacing(3),
  },
  subtitle: {
    marginTop: -theme.spacing(2),
    paddingBottom: theme.spacing(2),
  },
}));

const myPlan = () => {
  const classes = useStyles();
  const consumer = useRequireConsumer(myPlanRoute);
  const plan = consumer.data && consumer.data.Plan;
  const cuisines = plan ? plan.Cuisines : [];
  // const day = plan ? plan.DeliveryDay : 0;
  // const deliveryTime = plan ? plan.deliveryTime : ConsumerPlan.getDefaultDeliveryTime();
  const plans = useGetAvailablePlans();
  const [updateMyPlan, updateMyPlanRes] = useUpdateMyPlan();
  const validateCuisineRef= useRef<() => boolean>();
  const [cancelSubscription, cancelSubscriptionRes] = useCancelSubscription();
  const [prevPlan, setPrevPlan] = useState<ConsumerPlan | null>(null);
  const notify = useNotify();
  useMutationResponseHandler(cancelSubscriptionRes, () => {
    notify('Plan canceled.', NotificationType.success, false);
  });
  useMutationResponseHandler(updateMyPlanRes, () => {
    if (!consumer.data || !consumer.data.Plan) throw noConsumerPlanErr();
    if (!plans.data) {
      const err = new Error('Missing plans');
      console.error(err.stack);
      throw err;
    }
    if (!prevPlan) {
      const err = new Error('No prev plan');
      console.error(err.stack);
      throw err;
    }
    let msg = '.';
    // const newMealCount = Plan.getPlanCount(consumer.data.Plan.StripePlanId, plans.data);
    // const prevMealCount = Plan.getPlanCount(prevPlan.StripePlanId, plans.data);
    // const newDeliveryDay = consumer.data.Plan.DeliveryDay;
    // if (newMealCount > prevMealCount) {
    //   msg = `. We added ${Math.abs(newMealCount - prevMealCount)} meals to your upcoming deliveries.`
    // } else if (newMealCount < prevMealCount) {
    //   msg = `. We removed ${Math.abs(newMealCount - prevMealCount)} meals from your upcoming deliveries.`
    // } else if (newDeliveryDay !== prevPlan.DeliveryDay) {
    //   msg = ` with new delivery day.`
    // }
    notify(`Plan updated${msg}`, NotificationType.success, false);
  });
  const noConsumerPlanErr = () => {
    const err = new Error(`No consumer plan '${JSON.stringify(consumer.data)}' for update plan`);
    console.error(err.stack);
    return err;
  }
  const count = 5;
  const onRemoveMeal = () => {

  }
  const onAddMeal = () => {
    
  }
  const updateCuisines = (cuisines: CuisineType[]) => {
    if (!consumer.data || !consumer.data.Plan) throw noConsumerPlanErr();
    setPrevPlan(consumer.data.Plan);
    sendChooseCuisineMetrics(cuisines, consumer.data.Plan.Cuisines);
    updateMyPlan(
      new ConsumerPlan({
        ...consumer.data.Plan,
        cuisines,
      }),
      consumer.data
    );
  };
  const onCancelSubscription = () => {
    if (!consumer.data || !consumer.data.Plan) throw noConsumerPlanErr();
    if (!plans.data) {
      const err = new Error('No plan');
      console.error(err.stack);
      throw err;
    }
    // sendCancelSubscriptionMetrics(
    //   Plan.getMealPrice(consumer.data.Plan.StripePlanId, plans.data),
    //   Plan.getPlanCount(consumer.data.Plan.StripePlanId, plans.data),
    // );
    cancelSubscription();
  }
  if (!consumer.data && !consumer.loading && !consumer.error) {
    return <Typography>Logging you in...</Typography>
  }
  if (consumer.error) {
    console.error(`Error getting consumer in my-plan: ${consumer.error}`);
    return null;
  }
  if (!consumer.data ) {
    if (consumer.loading) return <Typography variant='body1'>Loading...</Typography>;
    const err = new Error('No consumer plan');
    console.error(err.stack);
    return null;
  }

  return (
    <Container maxWidth='lg' className={classes.container}>
      <Notifier />
      <Typography variant='h3'>
        My plan
      </Typography>
      <Paper className={classes.paperContainer}>
      {
        plan ? 
          <>
            <Typography
              variant='h6'
              color='primary'
              className={classes.verticalPadding}
            >
              Meals enjoyed per week
            </Typography>
            <Counter
              subtractDisabled={!count}
              onClickSubtract={onRemoveMeal}
              subtractButtonProps={{
                variant: 'contained',
                className: `${classes.button} ${classes.minusButton}`
              }}
              subractIcon={<RemoveIcon />}
              chipLabel={count}
              chipDisabled={!count}
              onClickAdd={onAddMeal}
              addIcon={<AddIcon />}
              addButtonProps={{
                variant: 'contained',
                color: 'primary',
                className: classes.button
              }}
            />
            <Typography variant='subtitle2' className={classes.subtitle}>
              Upcoming deliveries will automatically update their meals
            </Typography>
            <Typography
              variant='h6'
              color='primary'
              className={classes.verticalPadding}
            >
              Preferred delivery day
            </Typography>
            <Typography variant='subtitle2' className={classes.subtitle}>
              Upcoming deliveries will automatically change dates
            </Typography>
            {/* <DeliveryDateChooser
              day={day}
              onDayChange={day => updateDay(day)}
              time={deliveryTime}
              onTimeChange={time => updateDeliveryTime(time)}
            /> */}
            <RenewalChooser
              cuisines={cuisines}
              onCuisineChange={cuisines => updateCuisines(cuisines)}
              validateCuisineRef={validateCuisine => {
                validateCuisineRef.current = validateCuisine;
              }}
            />
            <Button
              variant='outlined'
              className={classes.cancel}
              onClick={onCancelSubscription}
            >
              Cancel subscription
            </Button>
          </>
        :
        <>
          <Typography
            variant='h6'
            color='primary'
            className={classes.verticalPadding}
          >
            Choose a meal plan to get started
          </Typography>
          {/* <PlanCards onClickCard={onClickCardNoSubscription} /> */}
        </>
      }
      </Paper>
    </Container>
  );
}

export default withApollo(myPlan); 

export const myPlanRoute = '/consumer/my-plan';