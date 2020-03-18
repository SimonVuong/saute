
import { RenewalTypes, RenewalType, CuisineTypes, CuisineType } from "../../consumer/consumerModel";
import { Typography, makeStyles, Grid, Button } from "@material-ui/core";
import ToggleButton from '@material-ui/lab/ToggleButton';
import ToggleButtonGroup from '@material-ui/lab/ToggleButtonGroup';
import { useState} from "react";

const useStyles = makeStyles(theme => ({
  toggleButtonGroup: {
    width: '100%',
  },
  title: {
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(2),
  },
  subtitle: {
    marginTop: -theme.spacing(2),
    paddingBottom: theme.spacing(2),
  },
}));

const RenewalChooser: React.FC<{
  validateCuisineRef: (validateCuisine: () => boolean) => void,
  renewal: RenewalType,
  cuisines: CuisineType[],
  onRenewalChange: (renewal:RenewalType) => void,
  onCuisineChange: (cuisine:CuisineType[]) => void
}>= ({
  onCuisineChange,
  onRenewalChange,
  cuisines,
  renewal,
  validateCuisineRef
}) => {
  const [cuisinesError, setCuisinesError] = useState<string>('');
  const classes = useStyles();
  const validateCuisine = () => { 
    if (cuisines.length === 0 && renewal === RenewalTypes.Auto) {
      if (!cuisinesError) setCuisinesError('Please pick 1 type')
      return false;
    }
    if (cuisinesError) setCuisinesError('');
    return true;
  }
  // Pass function back up to parent
  validateCuisineRef(validateCuisine);
  validateCuisine()
  return (
    <>
      <Grid container>
        <Grid item xs={12}>
          <Typography variant='subtitle2' className={classes.subtitle}>
            How do you want to handle meals for next week?
          </Typography>
        </Grid>
        <Grid item xs={12}>
          <ToggleButtonGroup
            className={classes.toggleButtonGroup}
            size='small'
            exclusive
            value={renewal}
            onChange={(_, rt: RenewalType) => {
              // rt === null when selecting button
              if (rt === null) return;
              onRenewalChange(rt);
            }}
          >
            <ToggleButton value={RenewalTypes.Auto}>
              Pick for me
            </ToggleButton>
            <ToggleButton value={RenewalTypes.Skip}>
              Skip them
            </ToggleButton>
          </ToggleButtonGroup>
        </Grid>
      </Grid>
      {renewal === RenewalTypes.Auto &&
        <Grid container>
          <Grid item xs={12}>
            <Typography
              variant='h6'
              color='primary'
              className={classes.title}
            >
              What foods would you like in your meal plan?
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <Typography variant='subtitle2' className={classes.subtitle}>
              We only pick 1 restaurant per week
            </Typography>
            <Typography
              component='p'
              variant='caption'
              color='error'
              className={classes.subtitle}
            >
              {cuisinesError}
            </Typography>
          </Grid>
          <Grid container spacing={2}>
            {Object.values<CuisineType>(CuisineTypes).map(cuisine => {
              const withoutCuisine = cuisines.filter(c => cuisine !== c);
              const isSelected = withoutCuisine.length !== cuisines.length;
              return (
                <Grid
                  key={cuisine}
                  item
                  xs={6}
                  sm={4}
                  lg={3}
                >
                  <Button
                    fullWidth
                    color='primary'
                    variant={isSelected ? 'contained' : 'outlined'}
                    onClick={() => 
                      isSelected ? onCuisineChange(withoutCuisine) : onCuisineChange([...cuisines, cuisine])
                    }
                  >
                    {cuisine}
                  </Button>
                </Grid>
              )
            })}
          </Grid>
        </Grid>
      }
    </>
  );
}

export default RenewalChooser;