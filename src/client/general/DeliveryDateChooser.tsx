import ToggleButton from '@material-ui/lab/ToggleButton';
import { makeStyles, FormControl, InputLabel, Select, MenuItem } from "@material-ui/core";
import ToggleButtonGroup from '@material-ui/lab/ToggleButtonGroup';
import { deliveryDay } from "../../consumer/consumerModel";
import { useState, useRef, useEffect } from "react";
import withClientApollo from '../utils/withClientApollo';

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
}> = ({ onDayChange, day }) => {
  const classes = useStyles();
  const inputLabel = useRef<HTMLLabelElement>(null);
  const [labelWidth, setLabelWidth] = useState(0);
  useEffect(() => {
    setLabelWidth(inputLabel.current!.offsetWidth);
  }, []);
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
          Sun
        </ToggleButton>
        <ToggleButton value={3}>
          Wed
        </ToggleButton>
        <ToggleButton value={5}>
          Fri
        </ToggleButton>
      </ToggleButtonGroup>
      <FormControl variant='filled' className={`${classes.input} ${classes.smallPaddingBottom}`}>
        <InputLabel ref={inputLabel}>
          Another day
        </InputLabel>
        <Select
          labelWidth={labelWidth}
          value={day === 0 || day === 3 || day === 5 ? '' : day}
          onChange={e => onDayChange(e.target.value as deliveryDay)}
        >
          <MenuItem value={1}>Mon</MenuItem>
          <MenuItem value={2}>Tue</MenuItem>
          <MenuItem value={4}>Thur</MenuItem>
          <MenuItem value={6}>Sat</MenuItem>
        </Select>
      </FormControl>
    </>
  );
}

export default withClientApollo(DeliveryDateChooser);