export S3_ACCESS_KEY=`cat /run/secrets/access_key`
export S3_SECRET_KEY=`cat /run/secrets/secret_key`

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
