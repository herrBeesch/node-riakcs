# Node-riakcs -- talk to riakcs like you would with awssum

## Install

<pre>
  npm install node-riakcs
</pre>

## Configure your client with the host

Request is designed to be the simplest way possible to make http calls. It supports HTTPS and follows redirects by default.

```javascript
var s3 = new S3({
    'accessKeyId' : "<YOUR_KEY_ID>",
    'secretAccessKey' : "<YOUR_SECRET>",
    'region' : riakcs.STORAGE
    'hostname' : "storage.relax"
});
```
