#!/bin/bash

SAT=$1
FREQ=$2
TLE_FILE=INSTALL_DIR/weather.tle
PREDICTION_START=`/usr/bin/predict -t $TLE_FILE -p "$SAT" | head -1`
PREDICTION_END=`/usr/bin/predict -t $TLE_FILE -p "$SAT" | tail -1`

END_EPOCH=`echo $PREDICTION_END | cut -d " " -f 1`
END_EPOCH_DATE=`date --date="TZ=\"UTC\" @${END_EPOCH}" +%D`

MAXELEV=`/usr/bin/predict -t $TLE_FILE -p "${SAT}" | awk -v max=0 '{if($5>max){max=$5}}END{print max}'`
START_LAT=`echo $PREDICTION_START | awk '{print $8}'`
END_LAT=`echo $PREDICTION_END | awk '{print $8}'`
if [ $START_LAT -gt $END_LAT ]
  then
    DIR="southbound"
  else
    DIR="northbound"
fi


while [ $END_EPOCH_DATE == `date +%D` ] || [ $END_EPOCH_DATE == `date --date="tomorrow" +%D` ]; do

  START_TIME=`echo $PREDICTION_START | cut -d " " -f 3-4`
  START_EPOCH=`echo $PREDICTION_START | cut -d " " -f 1`

  SECONDS_REMAINDER=`echo $START_TIME | cut -d " " -f 2 | cut -d ":" -f 3`

  JOB_START=`date --date="TZ=\"UTC\" $START_TIME" +"%H:%M %D"`

  # at jobs can only be started on minute boundaries, so add the
  # seconds remainder to the duration of the pass because the
  # recording job will start early
  PASS_DURATION=`expr $END_EPOCH - $START_EPOCH`
  JOB_TIMER=`expr $PASS_DURATION + $SECONDS_REMAINDER`
  OUTDATE=`date --date="TZ=\"UTC\" $START_TIME" +%Y%m%d-%H%M%S`

  if [ $MAXELEV -ge 20 ]
    then
      FILEKEY="${SAT//" "}-${OUTDATE}"
      COMMAND="INSTALL_DIR/receive_and_process_satellite.sh \"${SAT}\" $FREQ $FILEKEY $TLE_FILE $START_EPOCH $JOB_TIMER $MAXELEV $DIR"
      echo $COMMAND
      echo $COMMAND | at $JOB_START

      TLE1=`grep "$SAT" $TLE_FILE -A 2 | tail -2 | head -1 | tr -d '\r'`
      TLE2=`grep "$SAT" $TLE_FILE -A 2 | tail -2 | tail -1 | tr -d '\r'`

      echo ${START_EPOCH},${END_EPOCH},${MAXELEV},${DIR},${SAT},"${TLE1}","${TLE2}" >>  INSTALL_DIR/upcoming_passes.txt
  fi

  nextpredict=`expr $END_EPOCH + 60`

  PREDICTION_START=`/usr/bin/predict -t $TLE_FILE -p "${SAT}" $nextpredict | head -1`
  PREDICTION_END=`/usr/bin/predict -t $TLE_FILE -p "${SAT}"  $nextpredict | tail -1`

  MAXELEV=`/usr/bin/predict -t $TLE_FILE -p "${SAT}" $nextpredict | awk -v max=0 '{if($5>max){max=$5}}END{print max}'`
  START_LAT=`echo $PREDICTION_START | awk '{print $8}'`
  END_LAT=`echo $PREDICTION_END | awk '{print $8}'`
  if [ $START_LAT -gt $END_LAT ]
    then
      DIR="southbound"
    else
      DIR="northbound"
  fi

  END_EPOCH=`echo $PREDICTION_END | cut -d " " -f 1`
  END_EPOCH_DATE=`date --date="TZ=\"UTC\" @${END_EPOCH}" +%D`

done
