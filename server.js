var express = require("express")
, bodyParser = require("body-parser")
, cookieParser = require("cookie-parser")
, passport = require("passport")
, FacebookStrategy = require("passport-facebook").Strategy
, mustacheExpress = require("mustache-express");

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

var FACEBOOK_APP_ID = process.env.WINNECT_FACEBOOK_ID;
var FACEBOOK_APP_SECRET = process.env.WINNECT_FACEBOOK_SECRET;

passport.serializeUser(function(user,done){
	done(null,user);
});

passport.deserializeUser(function(obj, done){
	done(null,obj);
});

passport.use(new FacebookStrategy({
		clientID: FACEBOOK_APP_ID,
		clientSecret: FACEBOOK_APP_SECRET,
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
		res.redirect('/');
});

app.get("/", function(req, res){
	res.render("home");
});

app.get("/login", function(req, res){
	res.render("login");
});

app.listen(app.get("port"), function(){
	console.log("Express server listening on port " + app.get("port"));
});