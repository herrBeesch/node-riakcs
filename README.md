# Node-riakcs -- talk to riakcs like you would with awssum

## Install

<pre>
  npm install node-riakcs
</pre>

## Configure your client 

Request is designed to be the simplest way possible to make http calls. It supports HTTP.

```javascript
var S3, awssum, riakcs, s3;
awssum = require('node-riakcs/awssum');
riakcs = awssum.load('riakcs');
riakcs.MYREGION = "<YOUR_HOST_OR_REGION>";
S3 = awssum.load('s3').S3;
S3.endPoint[riakcs.MYREGION] = "<YOUR_HOST_OR_REGION>";

var s3 = new S3({
    'accessKeyId' : "<YOUR_KEY_ID>",
    'secretAccessKey' : "<YOUR_SECRET>",
    'region' : riakcs.MYREGION
    'hostname' : "storage.relax"
});
```
