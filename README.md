# node-riakcs 
#####talk to riakCS like you would with awssum

## Install

<pre>
  npm install node-riakcs
</pre>

### Configure your client 

Request is designed to be the simplest way possible to make http calls. It supports HTTP.

```javascript
var S3, riakcs, s3;
riakcs = require('node-riakcs');
S3 = riakcs.load('s3').S3;

var s3 = new S3({
    'accessKeyId' : "<YOUR_KEY_ID>",
    'secretAccessKey' : "<YOUR_SECRET>",
    'hostname' : "<YOUR_HOST>"
});
```
## Examples (coffeescript + fmt)

### Get Buckets

```coffeescript
require 'fmt'
s3.ListBuckets (err, data)->
  if err?
    fmt.dump err, 'err'
  if data?
    fmt.dump data, 'data'
```

### Create a bucket

```coffeescript
require 'fmt'

bucketArgs = {
  BucketName : 'myBucket',
}

s3.CreateBucket bucketArgs , (err, data)->
  if err?
    fmt.dump err, 'err'
  else  
    fmt.dump data, 'data'
```

### Delete a bucket

```coffeescript
require 'fmt'

bucketArgs = {
  BucketName : 'myBucket'
}

s3.DeleteBucket bucketArgs , (err, data)->
  if err?
    fmt.dump err, 'err'
  else  
    fmt.dump data, 'data'
```

### Delete an object

```coffeescript
require 'fmt'

args = {
  ObjectName : 'myObject',
  BucketName : 'myBucket'
}

s3.DeleteObject Args , (err, data)->
  if err?
    fmt.dump err, 'err'
  else  
    fmt.dump data, 'data'
```

### Create a user (as admin user)

```coffeescript
require 'fmt'

userArgs = {
  Email: 'myname@mydomain.com',
  Name: 'my name',
  ContentType: 'application/json',
  UserPath : 'riak-cs/user'
}

s3.CreateUser userArgs, (err, data)->
  if err?
    fmt.dump err, 'err'
  if data?
    fmt.dump data, 'data'
```


### Get user information (as admin user for every user, or for oneself)
```coffeescript
require 'fmt'

s3.GetUser { ObjectName : "<USER_KEYS>", UserPath : 'riak-cs/user/'}, (err, data)->
  if err? 
    fmt.dump err, 'err'
  if data?
    fmt.dump data, 'data'
```