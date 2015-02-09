var express = require("express")
, bodyParser = require("body-parser")
, cookieParser = require("cookie-parser")
, passport = require("passport")
, FacebookStrategy = require("passport-facebook").Strategy
, mustacheExpress = require("mustache-express")
, expressSession = require("express-session")
, aws = require('aws-sdk')
, conn;

if(process.env.WINNECT_REDIS_DB_URL){
	var rtg = require("url").parse(process.env.WINNECT_REDIS_DB_URL);
	conn = require("redis").createClient(rtg.port, rtg.hostname);
	
	conn.auth(rtg.auth.split(":")[1]);
}
else{
	conn = require("redis").createClient();
}

var app = express();

app.engine("mustache", mustacheExpress());

app.set("port", process.env.PORT || 3000);
app.set("views", __dirname + "/views");
app.set("view engine", "mustache");

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));
app.use(cookieParser());
app.use(passport.initialize());
app.use(express.static(__dirname + "/public"));
app.use(expressSession({ secret : process.env.WINNECT_SESSION_SECRET }));

passport.serializeUser(function(user,done){
	done(null,user);
});

passport.deserializeUser(function(obj, done){
	done(null,obj);
});

passport.use(new FacebookStrategy({
		clientID: process.env.WINNECT_FACEBOOK_ID,
		clientSecret: process.env.WINNECT_FACEBOOK_SECRET,
		callbackURL: "http://localhost:3000/auth/facebook/callback"
	},
	function(accessToken, refreshToken, profile, done) {
		return done(null, profile);
	}
));

var AWS_ACCESS_KEY = process.env.WINNECT_AWS_ACCESS_KEY;
var AWS_SECRET_KEY = process.env.WINNECT_AWS_SECRET_KEY;
var S3_BUCKET = process.env.WINNECT_DEV_S3_BUCKET

app.get('/auth/facebook', passport.authenticate('facebook'),
	function(req, res){
});

app.get('/auth/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/login' }),
	function(req, res) {
		//console.log(req.user._json.id);
		var is_admin = req.user._json.id == process.env.WINNECT_ADMIN_FB_ID ? "true" : "false";

		//Save store_id into the req session
		req.session.store_id = req.user._json.name + ":" + req.user._json.id;
		req.session.winnect_admin = is_admin;
		
		conn.hmset(req.user._json.name+":"+req.user._json.id, {"name": req.user._json.name, "admin": is_admin});
		conn.hgetall(req.user._json.id, function(err, user_profile){
			console.log(user_profile);
			res.redirect('/user');
		});
		conn.keys("*", function(err,all_keys){
			console.log(all_keys)
		});
		
/*****************************************************
		//DEBUG USE ONLY
		conn.del(req.user._json.id, function(err, reply){
			console.log(reply);
		});
******************************************************/
});

app.get("/", function(req, res){
	res.redirect("/login");
});

app.get("/login", function(req, res){
	res.render("login");
});

app.get("/user", function(req, res){
	res.render("home");
});

app.get("/user/images", function(req, res){
	
	console.log(req.session.store_id);
	
	conn.hgetall(req.session.store_id, function(err, store_profile){
		console.log("*****");
		console.log(err);
		console.log(store_profile);
		console.log("*****");
		res.render("store_info", { "store_info" : store_profile });
	});
});

app.get('/sign_s3', function(req, res){
	aws.config.update({accessKeyId: AWS_ACCESS_KEY , secretAccessKey: AWS_SECRET_KEY });
	var s3 = new aws.S3(); 
	var s3_params = { 
		Bucket: S3_BUCKET, 
		Key: req.query.s3_object_name, 
		Expires: 60, 
		ContentType: req.query.s3_object_type, 
		ACL: 'public-read'
	}; 
	s3.getSignedUrl('putObject', s3_params, function(err, data){ 
		if(err){ 
			console.log(err); 
		}
		else{ 
			var return_data = {
				signed_request: data,
				url: 'https://'+S3_BUCKET+'.s3.amazonaws.com/'+req.query.s3_object_name 
			};
			res.write(JSON.stringify(return_data));
			res.end();
		} 
	});
});

/*
	* Admin Pages
	* Only admin will be allowed to access these pages. 
	* Admin is set through code and cannot be edited at the store level
	*/

app.get("/user/stores", function(req, res){
	conn.keys("*", function(err,all_stores){
		res.render("view_all_stores", { "stores" : all_stores} );
	});
});

app.get("/user/stores/:id", function(req, res){
	var store_id = req.params.id;
	conn.hgetall(store_id, function(err, store_profile){
		res.render("view_store", {"store_id": store_id, "store_info": store_profile});
	});
});

app.post("/user/stores/:id", function(req, res){
	res.redirect("/user/stores");
});

app.listen(app.get("port"), function(){
	console.log("Express server listening on port " + app.get("port"));
});