const mysql = require('mysql2/promise');

const mysqlHost = process.env.MYSQL_HOST || 'localhost';
const mysqlPort = process.env.MYSQL_PORT || '3306';
const mysqlDB = process.env.MYSQL_DB;
const mysqlUser = process.env.MYSQL_USER;
const mysqlPassword = process.env.MYSQL_PASSWORD;

// console.log(mysqlHost);
// console.log(mysqlPort);
// console.log(mysqlDB);
// console.log(mysqlUser);

const maxMySQLConnections = 10;
function connect() {
    const mysqlPool = mysql.createPool({
        connectionLimit: maxMySQLConnections,
        host: mysqlHost,
        port: mysqlPort,
        database: mysqlDB,
        user: mysqlUser,
        password: mysqlPassword
    });

    return mysqlPool;
}

module.exports = { connect };