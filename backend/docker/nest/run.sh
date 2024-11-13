if [ "$APP_ENV" == "prod" ]; then
    echo "PRODUCTION ENVIRONMENT"
    npm run start
elif [ "$APP_ENV" == "stagging" ]; then
    echo "DEV ENVIRONMENT"
    npm run start:dev
else
    echo "DEBUG ENVIRONMENT"
    npm run start:debug
fi
