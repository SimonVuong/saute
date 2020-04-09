import ToggleButton from '@material-ui/lab/ToggleButton';
import { makeStyles, FormControl, Select, MenuItem, Typography } from "@material-ui/core";
import ToggleButtonGroup from '@material-ui/lab/ToggleButtonGroup';
import { deliveryDay, deliveryTime, ConsumerPlan } from "../../consumer/consumerModel";
import withClientApollo from '../utils/withClientApollo';
import { getNextDeliveryDate } from '../../order/utils';

const useStyles = makeStyles(theme => ({
  smallPaddingBottom: {
    paddingBottom: theme.spacing(2),
  },
  toggleButtonGroup: {
    width: '100%',
    marginBottom: theme.spacing(2),
  },
  input: {
    alignSelf: 'stretch',
  },
}));

const DeliveryDateChooser: React.FC<{
  onDayChange: (d: deliveryDay) => void
  day: deliveryDay
  onTimeChange: (t: deliveryTime) => void
  time: deliveryTime
}> = ({
  onDayChange,
  day,
  onTimeChange,
  time,
}) => {
  const classes = useStyles();
  return (
    <>
      <ToggleButtonGroup
        className={classes.toggleButtonGroup}
        exclusive
        value={day}
        onChange={(_, d: deliveryDay) => {
          // d === null when selecting same day
          if (d === null) return;
          onDayChange(d);
        }}
      >
        <ToggleButton value={0}>
          Su
        </ToggleButton>
        <ToggleButton value={1}>
          M
        </ToggleButton>
        <ToggleButton value={2}>
          T
        </ToggleButton>
        <ToggleButton value={3}>
          W
        </ToggleButton>
        <ToggleButton value={4}>
          Th
        </ToggleButton>
        <ToggleButton value={5}>
          F
        </ToggleButton>
        <ToggleButton value={6}>
          Sa
        </ToggleButton>
      </ToggleButtonGroup>
      <Typography variant='body1'>
        First delivery day: <b>{getNextDeliveryDate(day).format('M/D/YY')}</b>
      </Typography>
      <FormControl variant='filled' className={`${classes.input} ${classes.smallPaddingBottom}`}>
        <Select
          value={time}
          onChange={e => onTimeChange(e.target.value as deliveryTime)}
        >
          {/* <MenuItem value={'OnePToTwoP'}>{ConsumerPlan.getDeliveryTimeStr('OnePToTwoP')}</MenuItem>
          <MenuItem value={'TwoPToThreeP'}>{ConsumerPlan.getDeliveryTimeStr('TwoPToThreeP')}</MenuItem> */}
          <MenuItem value={'ThreePToFourP'}>{ConsumerPlan.getDeliveryTimeStr('ThreePToFourP')}</MenuItem>
          <MenuItem value={'FourPToFiveP'}>{ConsumerPlan.getDeliveryTimeStr('FourPToFiveP')}</MenuItem>
          <MenuItem value={'FivePToSixP'}>{ConsumerPlan.getDeliveryTimeStr('FivePToSixP')}</MenuItem>
          <MenuItem value={'SixPToSevenP'}>{ConsumerPlan.getDeliveryTimeStr('SixPToSevenP')}</MenuItem>
        </Select>
      </FormControl>
    </>
  );
}

export default withClientApollo(DeliveryDateChooser);