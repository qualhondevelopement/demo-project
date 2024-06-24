const express = require('express');
const bodyParser = require('body-parser');
const { Sequelize, DataTypes } = require('sequelize');
const { SequelizeStorage, Umzug } = require('umzug');

const config = require('./config/config.json')['development'];
const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Serve static files (index.html)
app.use(express.static('public'));
// Initialize Sequelize
const sequelize = new Sequelize(config.database, config.username, config.password, {
    host: config.host,
    dialect: config.dialect,
    // logging: console.log, // Enable logging if needed
});

// Define User model
const User = sequelize.define('User', {
    balance: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 10000
    }
}, {
    timestamps: true
});

// Migrate the database
const umzug = new Umzug({
    migrations: { glob: 'migrations/*.js' },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
    // logger: console,
});

// Run migrations and then start the server
(async () => {
    try {
        await sequelize.authenticate();
        console.log('Connection to the database has been established successfully.');
        await umzug.up();
        console.log('Migrations have been run successfully.');
        await User.sync();
        console.log('User model synchronized successfully.');

        const userCount = await User.count();
        if (userCount === 0) {
            await User.create({ balance: 10000 });
            console.log('Initial user created successfully.');
        }
        app.listen(port, () => {
            console.log(`Server is running on http://localhost:${port}`);
        });
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
})();

// Route to update user's balance
app.post('/update-balance', async (req, res) => {
    const { userId, amount } = req.body;
    if (!userId || !amount) {
        return res.status(400).json({ error: 'userId and amount are required' });
    }

    try {
        const result = await sequelize.transaction(async (t) => {
            const user = await User.findByPk(userId, { lock: t.LOCK.UPDATE, transaction: t });
            if (!user) {
                throw new Error('User not found');
            }

            if (user.balance + Number(amount) < 0) {
                console.log("Insufficient funds")
                throw new Error('Insufficient funds');
            }

            user.balance += Number(amount);
            await user.save({ transaction: t });

            return user;
        });

        res.json({ balance: result.balance });
    } catch (error) {
        console.error('Transaction failed:', error);
        res.status(400).json({ error: error.message });
    }
});
// Route to check user's balance
app.get('/balance/:userId', async (req, res) => {
    const userId = req.params.userId;

    try {
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ balance: user.balance });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});


