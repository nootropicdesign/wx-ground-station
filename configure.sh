
# create directories
if [ ! -d "audio" ] 
then
    mkdir audio
fi

if [ ! -d "images" ] 
then
    mkdir images
fi

if [ ! -d "logs" ] 
then
    mkdir logs
fi

currentDir=`echo $PWD`
echo "configuring for" $currentDir

sed -i "s|INSTALL_DIR|$currentDir|g" schedule_all.sh
sed -i "s|INSTALL_DIR|$currentDir|g" schedule_satellite.sh
sed -i "s|INSTALL_DIR|$currentDir|g" receive_and_process_satellite.sh

chmod +x schedule_all.sh
chmod +x schedule_satellite.sh
chmod +x receive_and_process_satellite.sh

cronjobcmd="$currentDir/schedule_all.sh"
cronjob="0 0 * * * $cronjobcmd"
( crontab -l | grep -v -F "$cronjobcmd" ; echo "$cronjob" ) | crontab -
