const mongoose = require('mongoose');
const passport = require('passport');
const LocalStrategy = require('passport-local');


passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password',
}, async(email, password, done) => {
    const Users = mongoose.model('users');
    await Users.findOne({ email })
        .then((user) => {
            if (!user || !user.validatePassword(password)) {
                return done(null, false, { errors: { 'email or password': 'is invalid' } });
            }
            return done(null, user);
        }).catch(done);
}));