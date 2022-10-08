const express = require('express');
const app = express();
const PORT = process.env.PORT || 4000;
const { pool } = require("./dbConfig")
const bcrypt = require("bcrypt");
const session = require("express-session");
const flash = require("express-flash");
const passport = require("passport");
const initializePassport = require("./passportConfig")
require("dotenv").config();

initializePassport(passport);

app.use(express.urlencoded({ extended: false }));
app.set('view engine', 'ejs');


app.use(session({
    secret: process.env.sessionSecret,
    resave: false,
    saveUninitialized: false

}));

app.use(passport.initialize());
app.use(passport.session());

app.use(flash());


app.get('/', (req, res) => {
    res.render('index');
});

app.get('/users/login', checkAuthenticated, (req, res) => {
    res.render('login');
});

app.get('/users/register', checkAuthenticated, (req, res) => {
    res.render('register');
});

app.get('/users/dashboard', checkNotAuthenticated, (req, res) => {
    res.render('dashboard', { user: req.user.name });
});

app.post("/users/register", async (req, res) => {
    let { name, email, password, password2 } = req.body;
    let errors = [];
    if (!name || !email || !password || !password2) {
        errors.push({ message: "Please enter all fields" })
    }
    let minPasswordLength = 6;
    if (password.length < minPasswordLength) {
        errors.push({ message: `Password length should be at least ${minPasswordLength}` });
    }
    if (password != password2) {
        errors.push({ message: "Password do not match" });
    }
    if (errors.length > 0) {
        res.render("register", { errors });
    } else {
        let hashedPassword = await bcrypt.hash(password, 10);
        pool.query(
            `SELECT * FROM users
            WHERE email = $1`, [email], (err, results) => {
            if (err) {
                throw err;
            }
            if (results.rows.length > 0) {
                errors.push({ message: "A user with this email is already registered" });
                res.render("register", { errors });
            } else {
                pool.query(
                    `INSERT INTO users (name, email, password)
                    VALUES ($1, $2, $3)
                    RETURNING id, password`, [name, email, hashedPassword], (err, results) => {
                    if (err) {
                        throw err;
                    }
                    req.flash("success_msg", "You are registered. Log in");
                    res.redirect("/users/login");
                }
                )
            }
        }
        )

    }
})

app.post("/users/login", passport.authenticate("local", {
    successRedirect: "/users/dashboard",
    failureRedirect: "/users/login",
    failureFlash: true
})
);

app.get("/users/logout", function (req, res, next) {
    req.logout(function (err) {
        if (err) {
            return next(err);
        }
        req.flash("success_msg", "You logged out");
        res.redirect("/users/login");
    });
});

function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return res.redirect("/users/dashboard");
    }
    next();
}

function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect("/users/login");
}


app.post("/users/dashboard/add", (req, res) => {
    let { notification, date, time } = req.body;
    console.log("insert data into db..", { notification, date, time });

});



app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
})