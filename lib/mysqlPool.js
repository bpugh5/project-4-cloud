const mysql = require('mysql2/promise');

const mysqlHost = process.env.MYSQL_HOST || 'mysql';
const mysqlPort = process.env.MYSQL_PORT || '3306';
const mysqlDB = process.env.MYSQL_DATABASE;
const mysqlUser = process.env.MYSQL_USER;
const mysqlPassword = process.env.MYSQL_PASSWORD;

const maxMySQLConnections = 10;
const mysqlPool = mysql.createPool({
    connectionLimit: maxMySQLConnections,
    host: mysqlHost,
    port: mysqlPort,
    database: mysqlDB,
    user: mysqlUser,
    password: mysqlPassword
});
module.exports = mysqlPool;