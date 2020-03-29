import { Typography, makeStyles, Grid, Container, TextField, useMediaQuery, Theme, Button } from "@material-ui/core";
import { useGetCart } from "../client/global/state/cartState";
import withClientApollo from "../client/utils/withClientApollo";
import { isServer } from "../client/utils/isServer";
import Router from 'next/router'
import { menuRoute } from "./menu";
import StickyDrawer from "../client/general/StickyDrawer";
import { useState, useEffect, useRef, createRef } from "react";
import { state } from "../place/addressModel";
import { useTheme } from "@material-ui/styles";
import CardForm from "../client/checkout/CardForm";
import { StripeProvider, Elements, ReactStripeElements, injectStripe } from "react-stripe-elements";
import { CuisineType } from "../consumer/consumerModel";
import CheckoutCart from "../client/checkout/CheckoutCart";
import { activeConfig } from "../config";
import { usePlaceOrder } from "../client/order/orderService";
import { useNotify } from "../client/global/state/notificationState";
import { NotificationType } from "../client/notification/notificationModel";
import { Card } from "../card/cardModel";
import Notifier from "../client/notification/Notifier";
import PhoneInput from "../client/general/inputs/PhoneInput";
import { upcomingDeliveriesRoute } from "./consumer/upcoming-deliveries";
import RenewalChooser from '../client/general/RenewalChooser';
import EmailInput from "../client/general/inputs/EmailInput";
import AddressForm from "../client/general/inputs/AddressForm";
import GLogo from "../client/checkout/GLogo";
import { useSignUp, useGoogleSignIn, useGetLazyConsumer, useGetConsumer } from "../consumer/consumerService";
import { useGetRest } from "../rest/restService";
import { useGetAvailablePlans } from "../plan/planService";
import { Plan } from "../plan/planModel";
import { sendCheckoutMetrics } from "../client/checkout/checkoutMetrics";

const useStyles = makeStyles(theme => ({
  container: {
    background: 'none',
    marginTop: -theme.mixins.navbar.marginBottom,
  },
  inputs: {
    marginTop: theme.spacing(2),
    paddingBottom: theme.spacing(2),
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
    background: theme.palette.background.paper
  },
  title: {
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(2),
  },
}));

const checkout: React.FC<ReactStripeElements.InjectedStripeProps> = ({
  stripe,
  elements
}) => {
  const classes = useStyles();
  const cart = useGetCart();
  const signInGoogle = useGoogleSignIn();
  const notify = useNotify();
  const [getConsumer] = useGetLazyConsumer();
  const consumer = useGetConsumer();
  const validateAddressRef = useRef<() => boolean>();
  const addr1InputRef = createRef<HTMLInputElement>();
  const addr2InputRef = createRef<HTMLInputElement>();
  const cityInputRef = createRef<HTMLInputElement>();
  const zipInputRef = createRef<HTMLInputElement>();
  const [state, setState] = useState<state | ''>('');
  const validatePhoneRef = useRef<() => boolean>();
  const phoneInputRef = createRef<HTMLInputElement>();
  const [deliveryInstructions, setDliveryInstructions] = useState<string>('')
  const [cuisines, setCuisines] = useState<CuisineType[]>([]);
  const [accountName, setAccountName] = useState<string>('');
  const [accountNameError, setAccountNameError] = useState<string>('');
  const validateEmailRef = useRef<() => boolean>();
  const emailInputRef = createRef<HTMLInputElement>();
  const [password, setPassword] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');
  const [placeOrder, placeOrderRes] = usePlaceOrder();
  const rest = useGetRest(cart ? cart.RestId : null);
  const [signUp, signUpRes] = useSignUp();
  const validateCuisineRef= useRef<() => boolean>();
  const theme = useTheme<Theme>();
  const isMdAndUp = useMediaQuery(theme.breakpoints.up('md'));
  const pm = useRef<stripe.PaymentMethodResponse>();
  const plans = useGetAvailablePlans();

  useEffect(() => {
    if (placeOrderRes.error) {
      notify('Sorry, something went wrong', NotificationType.error, false);
    }
    if (placeOrderRes.data !== undefined) {
      if (placeOrderRes.data.error) {
        notify(placeOrderRes.data.error, NotificationType.error, false);
      } else {
        Router.push({
          pathname: upcomingDeliveriesRoute,
          query: { confirmation: 'true' },
        })
      }
    }
  }, [placeOrderRes]);

  useEffect(() => {
    if (signUpRes.error) {
      notify('Sorry, something went wrong', NotificationType.error, false);
    }
    if (signUpRes.data !== undefined) {
      if (signUpRes.data.error) {
        notify(signUpRes.data.error, NotificationType.error, false);
      } else {
        if (!cart || !pm.current) {
          const err = new Error(`Cart or paymentMethod empty cart '${cart}' pm '${pm.current}'`);
          console.error(err.stack)
          throw err;
        }
        if (!signUpRes.data.res) {
          const err = new Error('Sign up res is null but has no error');
          console.error(err.stack)
          throw err;
        }
        placeOrder(
          {
            _id: signUpRes.data.res.Id,
            name: signUpRes.data.res.Profile.Name,
            email: signUpRes.data.res.Profile.Email
          },
          cart.getCartInput(
            addr1InputRef.current!.value,
            addr2InputRef.current!.value,
            cityInputRef.current!.value,
            state as state,
            zipInputRef.current!.value,
            phoneInputRef.current!.value,
            Card.getCardFromStripe(pm.current.paymentMethod!.card),
            pm.current.paymentMethod!.id,
            deliveryInstructions,
            cuisines,
          )
        );
      }
    }
  }, [signUpRes]);

  if (isServer()) {
    return <Typography>Redirecting...</Typography>
  } else if (!cart) {
    Router.replace(menuRoute);
    return <Typography>Redirecting...</Typography>
  }

  if (consumer && consumer.data) {
    if (consumer.data.StripeSubscriptionId && !placeOrderRes.called) {
      Router.replace(menuRoute)
      return <Typography>Redirecting...</Typography>
    }
  }

  const validate = () => {
    let isValid = true;
    if (!validatePhoneRef.current!()) {
      isValid = false;
    }
    if (!validateAddressRef.current!()) {
      isValid = false;
    }
    if (!consumer && !accountName) {
      setAccountNameError('Your name is incomplete');
      isValid = false;
    }
    if (!consumer && !validateEmailRef.current!()) {
      isValid = false;
    }
    if (!consumer && !password) {
      setPasswordError('Your password is incomplete');
      isValid = false;
    }
    if (!validateCuisineRef.current!()) {
      isValid = false;
    }
    return isValid;
  }
  
  const onClickGoogle = async () => {
    try {
      await signInGoogle();
      getConsumer();
    } catch (e) {
      const err = new Error(`Failed to sign in with google`);
      console.error(err.stack);
      throw err;
    }
  }

  const onClickPlaceOrder = async () => {
    if (!validate()) return;
    if (!stripe) {
      const err = new Error('Stripe not initialized');
      console.error(err.stack);
      throw err;
    }
    if (!cart) {
      const err =  new Error('Cart is null');
      console.error(err.stack);
      throw err;
    }
    if (!elements) {
      const err =  new Error('No elements');
      console.error(err.stack);
      throw err;
    }
    if (!rest.data) {
      const err = new Error(`No rest`);
      console.error(err.stack);
      throw err;
    }
    if (!plans.data) {
      const err = new Error(`No rest`);
      console.error(err.stack);
      throw err;
    }
    if (!cart.StripePlanId) {
      const err = new Error(`No cart stripePlanId`);
      console.error(err.stack);
      throw err;
    }
    const cardElement = elements.getElement('cardNumber');
    if (!cardElement) {
      const err =  new Error('No card element');
      console.error(err.stack);
      throw err;
    }
    const billingName = (!consumer || !consumer.data) ? accountName : consumer.data.Profile.Name;
    try {
      pm.current = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
        billing_details: { name: billingName },
      });
    } catch (e) {
      const err = new Error(`Failed to createPaymentMethod for accountName '${accountName}'`);
      console.error(err.stack);
      throw err;
    }
    if (pm.current.error) {
      const err = new Error(`Failed to generate stripe payment method: ${JSON.stringify(pm.current.error)}`);
      console.error(err.stack);
      throw err;
    }

    sendCheckoutMetrics(
      cart,
      rest.data.Profile.Name,
      Plan.getMealPrice(cart.StripePlanId, plans.data),
      Plan.getPlanCount(cart.StripePlanId, plans.data),
      cuisines,
    )
    if (!consumer || !consumer.data) {
      signUp(emailInputRef.current!.value, accountName, password);
    } else {
      placeOrder(
        {
          _id: consumer.data.Id,
          name: consumer.data.Profile.Name,
          email: consumer.data.Profile.Email,
        },
        cart.getCartInput(
          addr1InputRef.current!.value,
          addr2InputRef.current!.value,
          cityInputRef.current!.value,
          state as state,
          zipInputRef.current!.value,
          phoneInputRef.current!.value,
          Card.getCardFromStripe(pm.current.paymentMethod!.card),
          pm.current.paymentMethod!.id,
          deliveryInstructions,
          cuisines,
        ),
      );
    }
  }
  return (
    <Container
      maxWidth='xl'
      className={classes.container}
    >
      <Notifier />
      <Grid container alignItems='stretch'>
        <Grid
          item
          sm={12}
          md={8}
          lg={9}
          className={classes.inputs}
        >
          <Typography
            variant='h6'
            color='primary'
            className={classes.title}
          >
            Delivery Address
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <AddressForm
                setValidator={(validator: () => boolean) => {
                  validateAddressRef.current = validator;
                }}
                addr1InputRef={addr1InputRef}
                addr2InputRef={addr2InputRef}
                cityInputRef={cityInputRef}
                zipInputRef={zipInputRef}
                state={state}
                setState={setState}
              />
            </Grid>
            <Grid
              item
              xs={12}
              md={6}
            >
              <PhoneInput
                inputRef={phoneInputRef}
                setValidator={(validator: () => boolean) => {
                  validatePhoneRef.current = validator;
                }}
              />
            </Grid>
            <Grid
              item
              xs={12}
              md={6}
            >
              <TextField
                label='Delivery instructions'
                variant='outlined'
                size='small'
                fullWidth
                value={deliveryInstructions}
                onChange={e => setDliveryInstructions(e.target.value)}
              />
            </Grid>
          </Grid>
          <Typography
            variant='h6'
            color='primary'
            className={classes.title}
          >
            Account
          </Typography>
          {
            consumer && consumer.data ?
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant='body1'>
                  {consumer.data.Profile.Name}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant='body1'>
                  {consumer.data.Profile.Email}
                </Typography>
              </Grid>
            </Grid>
            :
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label='Name'
                  variant='outlined'
                  size='small'
                  fullWidth
                  error={!!accountNameError}
                  helperText={accountNameError}
                  value={accountName}
                  onChange={e => {
                    setAccountName(e.target.value);
                    if (accountNameError) setAccountNameError('');
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <EmailInput
                  inputRef={emailInputRef}
                  defaultValue={''}
                  setValidator={(validator: () => boolean) => {
                    validateEmailRef.current = validator;
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label='Password'
                  type='password'
                  variant='outlined'
                  size='small'
                  error={!!passwordError}
                  helperText={passwordError}
                  fullWidth
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError('');
                  }}
                />
              </Grid>
              <Grid xs={12} item>
                <Typography color='textSecondary' align='center'>
                  or
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Button
                  variant='outlined'
                  onClick={onClickGoogle}
                  startIcon={<GLogo />}
                >
                  Sign up with google
                </Button>
              </Grid>
            </Grid>
          }
          <Typography
            variant='h6'
            color='primary'
            className={classes.title}
          >
            Payment
          </Typography>
          <CardForm />
          <RenewalChooser
            cuisines = {cuisines}
            validateCuisineRef={validateCuisine => {
              validateCuisineRef.current = validateCuisine;
            }}
            onCuisineChange={cuisines => setCuisines(cuisines)}
          />
        </Grid>
        {
          isMdAndUp &&
          <Grid
            item
            md={4}
            lg={3}
          >
            <StickyDrawer>
              <CheckoutCart onPlaceOrder={onClickPlaceOrder} />
            </StickyDrawer>
          </Grid>
        }
        {
          !isMdAndUp &&
          <Grid
            item
            sm={12}
            className={`${classes.inputs} ${classes.title}`}
          >
            <CheckoutCart buttonBottom onPlaceOrder={onClickPlaceOrder} />
          </Grid>
        }
      </Grid>
    </Container>
  )
}

const CheckoutContainer = withClientApollo(injectStripe(checkout));

export default () => {
  let stripe = null;
  if (!isServer()) {
    stripe = window.Stripe(activeConfig.client.stripe.key)
  }
  return (
    <StripeProvider stripe={stripe}>
      <Elements>
        <CheckoutContainer />
      </Elements>
    </StripeProvider>
  )
}

export const checkoutRoute = '/checkout';