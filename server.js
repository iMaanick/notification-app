const express = require('express');
const app = express();
const PORT = process.env.PORT || 4000;
const { pool } = require("./dbConfig")
const bcrypt = require("bcrypt");
const session = require("express-session");
const flash = require("express-flash");
const passport = require("passport");
const initializePassport = require("./passportConfig")
const cron = require("node-cron");
const nodemailer = require("nodemailer")

const webPush = require('web-push');
const bodyParser = require('body-parser');
const path = require('path');



require("dotenv").config();

app.use(bodyParser.json());
const publicVapidKey = 'BJOcvM1pcVl85NjYdxHEIjJA8IAWG7RHPS6zEwVN8mdw7X0rUQN08CW10NGpIaRYQ7aPh3BGu0iVqa8I2F_1MqA';
const privateVapidKey = 'lWcfVFRp6-XX4ymbjXZSxftbb1CHstmfwRmjK8gzW7M';

webPush.setVapidDetails('mailto:test@example.com', publicVapidKey, privateVapidKey);


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

app.use(express.static("./views"));


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

    pool.query(
        `SELECT to_char(date,'DD-MM-YYYY'), text, time FROM notifications
        WHERE user_id = $1`, [req.user.id], (err, dataList) => {
        if (err) {
            throw err;
        }
        res.render('dashboard', { user: req.user.name, dataList: dataList.rows });
    })
});

app.post('/users/dashboard', checkNotAuthenticated, (req, res) => {
    let { notification, date, time } = req.body;
    pool.query(
        `INSERT INTO notifications (text, time, date, user_id)
        VALUES ($1, $2, $3, $4)`, [notification, time, date, req.user.id], (err, results) => {
        if (err) {
            throw err;
        }
        res.redirect('/users/dashboard');
    })
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
    successRedirect: "/home",
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
        return res.redirect("/home");
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


app.get('/home', checkNotAuthenticated, function (req, res, err) {
    pool.query(
        `SELECT to_char(date,'DD-MM-YYYY'), text, time, id FROM notifications
        WHERE user_id = $1`, [req.user.id], (err, dataList) => {
        if (err) {
            throw err;
        }
        return res.render('home', {
            tittle: "Home",
            task: dataList.rows
        });
    })
});

async function updateCompletedTasks(id){
    const tasks_completed = await pool.query(
        `SELECT tasks_completed FROM users 
        WHERE id = $1`, [id]
    )
        
    await pool.query(
        `UPDATE users set tasks_completed = tasks_completed + 1
        WHERE id = ($1)`, [id], (err, results) => {
        if (err) {
            throw err;
        }
    })

}
async function updateFailedTasks(id){
    const tasks_completed = await pool.query(
        `SELECT tasks_failed FROM users 
        WHERE id = $1`, [id]
    )
        
    await pool.query(
        `UPDATE users set tasks_failed = tasks_failed + 1
        WHERE id = ($1)`, [id], (err, results) => {
        if (err) {
            throw err;
        }
    })

}
// app.get('/home/delete-task', checkNotAuthenticated, async function (req, res, err) {
//     // get the id from query
    
//     var id = req.query;
//     console.log(req.body['202'])
//     // checking the number of tasks selected to delete

//     var count = Object.keys(id).length;
//     for (let i = 0; i < count; i++) {

//         pool.query(

//             `
//             DELETE FROM notifications 
//             WHERE id = $1
//             `, [Object.keys(id)[i]], function (err) {
//             if (err) {
//                 console.log('error in deleting task');
//             }
//             updateCompletedTasks(req.user.id);
//         })
//         console.log('deleting', Object.keys(id)[i]);
//     }
//     //return res.redirect('/home');
// });

app.get("/success", (req, res) => {
    console.log('huoi')
     // get the id from query
    
     var id = req.query;
     console.log(req.body['202'])
     // checking the number of tasks selected to delete
 
     var count = Object.keys(id).length;
     for (let i = 0; i < count; i++) {
 
         pool.query(
 
             `
             DELETE FROM notifications 
             WHERE id = $1
             `, [Object.keys(id)[i]], function (err) {
             if (err) {
                 console.log('error in deleting task');
             }
             updateCompletedTasks(req.user.id);
         })
         pool.query(
 
            `
            DELETE FROM reminders 
            WHERE notification_id = $1
            `, [Object.keys(id)[i]], function (err) {
            if (err) {
                console.log('error in deleting task');
            }
        })
         console.log('deleting', Object.keys(id)[i]);
     }
     return res.redirect('/home');

});

app.get("/fail", (req, res) => {
    console.log('ayayay')
     // get the id from query
    
     var id = req.query;
     console.log(req.body['202'])
     // checking the number of tasks selected to delete
 
     var count = Object.keys(id).length;
     for (let i = 0; i < count; i++) {
 
         pool.query(
 
             `
             DELETE FROM notifications 
             WHERE id = $1
             `, [Object.keys(id)[i]], function (err) {
             if (err) {
                 console.log('error in deleting task');
             }
             updateFailedTasks(req.user.id);
         })
         pool.query(
 
            `
            DELETE FROM reminders 
            WHERE notification_id = $1
            `, [Object.keys(id)[i]], function (err) {
            if (err) {
                console.log('error in deleting task');
            }
        })
         console.log('deleting', Object.keys(id)[i]);
     }
     return res.redirect('/home');

});


app.post('/home/add-task',  checkNotAuthenticated, async (req, res) => {
    let { notification, date, time, reminder_date2, reminder_time2 } = req.body;
    console.log(reminder_date2, reminder_time2);
    await pool.query(
        `INSERT INTO notifications (text, time, date, user_id)
        VALUES ($1, $2, $3, $4) RETURNING id;`, [notification, time, date, req.user.id], (err, results) => {
        if (err) {
            throw err;
        }

        pool.query(
            `INSERT INTO reminders (text, time, date, notification_id)
            VALUES ($1, $2, $3, $4);`, [notification, reminder_time2, reminder_date2, results.rows[0].id], (err, results) => {
            if (err) {
                throw err;
            }    
        })
        //console.log(results.rows[0].id);
    })
    res.redirect('/home');
});


let mailOptions = {
    from: "nickolaytrusov@mail.ru",
    to: "",
    subject: "Notification",
    text: "11111"
};
const transporter = nodemailer.createTransport({
    host: 'smtp.mail.ru',
    port: 465,
    secure: true, // true for 465, false for other ports
    auth: {
        user: "nickolaytrusov@mail.ru",
        pass: process.env.emailPass
    }
});

cron.schedule('* * * * *', async () => {

    const data = await pool.query(
        `SELECT to_char(date,'YYYY-MM-DD'), text, time, id, user_id FROM notifications`
    )
    const date = new Date();
    data.rows.forEach(async (element) => {
        if (Date.parse(element.to_char + "T" + element.time + ".000Z") <= date) {
            console.log(element.user_id);
            const mail = await pool.query(
                `SELECT email FROM users
        WHERE id = $1`, [element.user_id]
            )
            if (mail.rows[0] != undefined) {
                mailOptions.to = mail.rows[0].email;
                mailOptions.text = element.text;
                /** 
                transporter.sendMail(mailOptions, (error, info) =>{
                    if (error){
                        console.log(error);
                    } else {
                        console.log('Email send: ' + info.response);
                    }
                })
                */
            }
        }
    });
})

app.post('/test', async (req, res) => {
    const subscription = req.body
    res.status(201).json({});

    const data = await pool.query(
        `SELECT to_char(date,'YYYY-MM-DD'), text, time, id, user_id FROM notifications 
        WHERE user_id = $1`, [req.user.id]
    )

    const date = new Date();
    data.rows.forEach(async (element) => {
        if (Date.parse(element.to_char + "T" + element.time + ".000Z") <= date) {
            // create payload
            const payload = JSON.stringify({
                title: `NOTIFICATION!`,
                body: `${element.text}`
            });

            webPush.sendNotification(subscription, payload)
                .catch(error => console.error(error));
        }
    });
});


app.post('/home/add-tg-username', checkNotAuthenticated, (req, res) => {
    let { telegram_username } = req.body;
    console.log(telegram_username);
    pool.query(
        `UPDATE users set telegram_username = ($1)
        WHERE id = ($2)`, [telegram_username, req.user.id], (err, results) => {
        if (err) {
            throw err;
        }
        res.redirect('/home');
    })
});

app.get('/users/profile', checkNotAuthenticated, (req, res) => {

    pool.query(
        `SELECT name, email, telegram_username, url_avatar, tasks_completed, tasks_failed FROM users
        WHERE id = $1`, [req.user.id], (err, userData) => {
        if (err) {
            throw err;
        }
        console.log(userData.rows[0]);
        res.render('profile', { tittle: "profile", userData: userData.rows[0] });
    })
});


app.post('/home/profile/addAvatar', checkNotAuthenticated, (req, res) => {
    let { avatar_url } = req.body;
    console.log(avatar_url);
    pool.query(
        `UPDATE users set url_avatar = ($1)
        WHERE id = ($2)`, [avatar_url, req.user.id], (err, results) => {
        if (err) {
            throw err;
        }
        res.redirect('/users/profile');
    })
});



app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
})