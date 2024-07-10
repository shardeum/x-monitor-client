# @shardus/monitor-client

## Releasing

If you're daring and want to cut and push a release to npm, you can do so
solely by running `npm run release`. But I warn you - with great power, comes
great responsibility ;)

## How to run a custom monitor client branch (dev) with a local network.

1. go to the monitor client folder:

-   run npm ci
-   run npm link
-   run npm run prepare

2. go to the monitor server folder:

-   run npm ci
-   run npm link @shardus/monitor-client
-   run npm run prepare

3. Go to your running (if running) shardeum-server folder

-   shardus pm2 list // find the index of monitor server usually 1
-   shardus pm2 stop <index> // index usually 1

4. go to monitor server folder

-   npm run start (edited)
