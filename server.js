var express = require("express")
, bodyParser = require("body-parser")
, cookieParser = require("cookie-parser")
, passport = require("passport")
, FacebookStrategy = require("passport-facebook").Strategy
, mustacheExpress = require("mustache-express")
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

app.get('/auth/facebook', passport.authenticate('facebook'),
	function(req, res){
});

app.get('/auth/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/login' }),
	function(req, res) {
		//console.log(req.user._json.id);
		var is_admin = req.user._json.id == process.env.WINNECT_ADMIN_FB_ID ? "true" : "false";
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