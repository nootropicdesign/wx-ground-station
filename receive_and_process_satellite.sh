#!/bin/bash

SAT=$1
FREQ=$2
FILEKEY=$3
TLE_FILE=$4
START_TIME=$5
DURATION=$6
ELEVATION=$7
DIRECTION=$8

AUDIO_DIR=INSTALL_DIR/audio
IMAGE_DIR=INSTALL_DIR/images
LOG_DIR=INSTALL_DIR/logs
MAP_FILE=${IMAGE_DIR}/${FILEKEY}-map.png
AUDIO_FILE=${AUDIO_DIR}/${FILEKEY}.wav
LOGFILE=${LOG_DIR}/${FILEKEY}.log

echo $@ >> $LOGFILE

#/usr/local/bin/rtl_biast -b 1 2>> $LOGFILE
sudo timeout $DURATION rtl_fm -f ${FREQ}M -s 60k -g 45 -p 0 -E wav -E deemp -F 9 - 2>> $LOGFILE | sox -t wav - $AUDIO_FILE rate 11025
#/usr/local/bin/rtl_biast -b 0 2>> $LOGFILE

PassStart=`expr $START_TIME + 90`

if [ -e $AUDIO_FILE ]
  then
    /usr/local/bin/wxmap -T "${SAT}" -H $TLE_FILE -p 0 -l 0 -o $PassStart ${MAP_FILE} >> $LOGFILE 2>&1

    /usr/local/bin/wxtoimg -m ${MAP_FILE} -e ZA $AUDIO_FILE ${IMAGE_DIR}/${FILEKEY}-ZA.png >> $LOGFILE 2>&1

    /usr/local/bin/wxtoimg -m ${MAP_FILE} -e NO $AUDIO_FILE ${IMAGE_DIR}/${FILEKEY}-NO.png >> $LOGFILE 2>&1

    /usr/local/bin/wxtoimg -m ${MAP_FILE} -e MSA $AUDIO_FILE ${IMAGE_DIR}/${FILEKEY}-MSA.png >> $LOGFILE 2>&1

    /usr/local/bin/wxtoimg -m ${MAP_FILE} -e MCIR $AUDIO_FILE ${IMAGE_DIR}/${FILEKEY}-MCIR.png >> $LOGFILE 2>&1

    /usr/local/bin/wxtoimg -m ${MAP_FILE} -e therm $AUDIO_FILE ${IMAGE_DIR}/${FILEKEY}-THERM.png >> $LOGFILE 2>&1

    TLE1=`grep "$SAT" $TLE_FILE -A 2 | tail -2 | head -1 | tr -d '\r'`
    TLE2=`grep "$SAT" $TLE_FILE -A 2 | tail -2 | tail -1 | tr -d '\r'`
    GAIN=`grep Gain $LOGFILE | head -1`
    CHAN_A=`grep "Channel A" $LOGFILE | head -1`
    CHAN_B=`grep "Channel B" $LOGFILE | head -1`

    echo "node INSTALL_DIR/aws-s3/upload-wx-images.js \"$SAT\" $FREQ ${IMAGE_DIR}/${FILEKEY} $ELEVATION $DIRECTION $DURATION \"${TLE1}\" \"${TLE2}\" \"$GAIN\" \"${CHAN_A}\" \"${CHAN_B}\"" >> $LOGFILE 2>&1
    node INSTALL_DIR/aws-s3/upload-wx-images.js "$SAT" $FREQ ${IMAGE_DIR}/${FILEKEY} $ELEVATION $DIRECTION $DURATION "${TLE1}" "${TLE2}" "$GAIN" "${CHAN_A}" "${CHAN_B}" >> $LOGFILE 2>&1
fi
