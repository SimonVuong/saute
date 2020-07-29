import { Container, makeStyles, Button, Typography } from "@material-ui/core";
import Faq from "../client/general/CommonQuestions";
import withClientApollo from "../client/utils/withClientApollo";
import Router from 'next/router'
import { menuRoute } from "./menu";
import { isServer } from "../client/utils/isServer";
import { useGetCart, useUpdateTags } from "../client/global/state/cartState";
import { useGetConsumer } from "../consumer/consumerService";
import { useState, useRef, useEffect } from "react";
import { Tag } from "../rest/tagModel";
import { useGetTags } from "../rest/restService";
import RenewalChooser from "../client/general/RenewalChooser";
import Link from "next/link";
import { deliveryRoute } from "./delivery";

const useStyles = makeStyles(theme => ({
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingBottom: theme.spacing(4),
    paddingTop: theme.spacing(4),
    marginBottom: theme.spacing(4),
    backgroundColor: theme.palette.common.white,
  },
  nextButton: {
    marginTop: theme.spacing(4),
  },
}));

const planAhead = () => {
  const classes = useStyles();
  const cart = useGetCart();
  const updateCartTags = useUpdateTags();
  const consumer = useGetConsumer();
  const [tags, setTags] = useState<Tag[]>([]);
  const validateCuisineRef= useRef<() => boolean>();
  const allTags = useGetTags();
  useEffect(() => {
    if (allTags.data) setTags(allTags.data);
  }, [allTags.data]);
  if (!cart) {
    if (!isServer()) Router.replace(`${menuRoute}`);
    return null;
  }
  if (consumer.data && consumer.data.Plan) {
    const err = new Error(`Consumer ${consumer.data.Id} nav'ed to future-weeks route`);
    console.warn(err.stack);
    if (!isServer()) Router.replace(`${menuRoute}`);
    return null;
  }
  const updateTags = (tags: Tag[]) => setTags(tags);
  const onNext = () => updateCartTags(tags);
  return (
    <>
      <Container className={classes.container}>
        <Typography variant='h3'>
          Plan ahead
        </Typography>
        <RenewalChooser
          allTags={allTags.data || []}
          tags={tags}
          onTagChange={tags => updateTags(tags)}
          validateCuisineRef={validateCuisine => {
            validateCuisineRef.current = validateCuisine;
          }}
        />
        <Link href={deliveryRoute}>
          <Button
            variant='contained'
            color='primary'
            fullWidth
            className={classes.nextButton}
            onClick={onNext}
          >
            Next
          </Button>
        </Link>
      </Container>
      <Faq />
    </>
  )
}

export default withClientApollo(planAhead);

export const planAheadRoute = '/plan-ahead';