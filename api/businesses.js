const router = require('express').Router();
const { validateAgainstSchema, extractValidFields } = require('../lib/validation');

const businesses = require('../data/businesses');
const { reviews } = require('./reviews');
const { photos } = require('./photos');

const mysqlPool = require('../lib/mysqlPool')

async function init() {
  await mysqlPool.query(
      `CREATE TABLE IF NOT EXISTS businesses (
          id MEDIUMINT NOT NULL AUTO_INCREMENT,
          ownerid INT NOT NULL,
          name varchar(30) NOT NULL,
          address varchar(30) NOT NULL,
          city varchar(30) NOT NULL,
          state varchar(30) NOT NULL,
          zip varchar(30) NOT NULL,
          phone varchar(30) NOT NULL,
          category varchar(30) NOT NULL,
          subcategory varchar(30),
          website varchar(30),
          PRIMARY KEY (id),
          FOREIGN KEY (ownerid) REFERENCES users(userid)
          INDEX idx_value (value)
      )`);
}

init();

exports.router = router;
exports.businesses = businesses;

/*
 * Schema describing required/optional fields of a business object.
 */
const businessSchema = {
  ownerid: { required: true },
  name: { required: true },
  address: { required: true },
  city: { required: true },
  state: { required: true },
  zip: { required: true },
  phone: { required: true },
  category: { required: true },
  subcategory: { required: true },
  website: { required: false },
  email: { required: false }
};

/*
 * Route to return a list of businesses.
 */
router.get('/', async function (req, res) {

  /*
   * Attempt to call getBusinessesPage and send response data back.
   * If it fails, send status code 500.
   */
  try {
    const businessesPage = await getBusinessesPage(page);
    res.status(200).send(businessesPage);
  } catch (err) {
    res.status(500).json({
      error: "Error fetching businesses list. Try again later."
    });
  }

  /*
   * Get the number of businesses in the table
   */
  async function getBusinessesCount() {
    const [ results ] = await mysqlPool.query(
      "SELECT COUNT(*) AS count FROM businesses"
    );

    return results[0].count;
  }

  /*
   * Get a paginated set of businesses from the table
   */
  async function getBusinessesPage(page) {
    const count = await getBusinessesCount();

    const pageSize = 10;
    const lastPage = Math.ceil(count / pageSize);
    page = page > lastPage ? lastPage : page;
    page = page < 1 ? 1 : page;
    const offset = (page - 1) * pageSize;

    const [ results ] = await mysqlPool.query(
      'SELECT * FROM businesses ORDER BY id LIMIT ?,?',
      [offset, pageSize]
    );

    return {
      businesses: results,
      page: page,
      totalPages: lastPage,
      pageSize: pageSize,
      count: count
    };
  }
});

/*
 * Route to create a new business.
 */
router.post('/', async function (req, res, next) {
  if (validateAgainstSchema(req.body, businessSchema)) {
    try {
      const id = await insertNewBusiness(req.body);
      res.status(201).send({ id: id });
    } catch (err) {
      res.status(500).send({
        error: "Error inserting business into DB."
      });
    }
  } else {
    res.status(400).json({
      error: "Request body is not a valid business object"
    });
  }

  async function insertNewBusiness(business) {
    const validatedBusiness = extractValidFields(business, businessSchema);

    const [ result ] = await mysqlPool.query(
      "INSERT INTO businesses SET ?", validatedBusiness
    );

    return result.insertId;
  }
});

/*
 * Route to fetch info about a specific business.
 */
router.get('/:businessid', async function (req, res, next) {
  const businessid = parseInt(req.params.businessid);
  /*
    * Find all reviews and photos for the specified business and create a
    * new object containing all of the business data, including reviews and
    * photos.
    */
  try {
    const business = getBusinessById(businessid);
    if (business) {
      res.status(200).send(business);
    } else {
      next();
    }
  } catch (err) {
    res.status(500).send({
      error: "Unable to fetch business."
    })
  }

  async function getBusinessById(businessID) {
    const [ results ] = await mysqlPool.query(
      "SELECT * FROM businesses WHERE id = ?",
      [ businessID ],
    );

    return results[0];
  }
});

/*
 * Route to replace data for a business.
 */
router.put('/:businessid', async function (req, res, next) {
  const businessid = parseInt(req.params.businessid);
  if (validateAgainstSchema(req.body, businessSchema)) {
    try {
      const updateSuccessful = await updateBusinessById(businessid, req.body);
      if (updateSuccessful) {
        res.status(200).send({});
      } else {
        next();
      }
    } catch (err) {
      res.status(500).send({
        error: "Unable to update business."
      });
    }
  } else {
    res.status(400).json({
      error: "Request body does not contain a valid business."
    });
  }

  async function updateBusinessById(businessId, business) {
    const validatedBusiness = extractValidFields(business, businessSchema);
    const [ result ] = mysqlPool.query(
      "UPDATE lodgings SET ? WHERE id = ?",
      [ validatedBusiness, businessId ]
    );

    return result.affectedRows > 0;
  }
});

/*
 * Route to delete a business.
 */
router.delete('/:businessid', async function (req, res, next) {
  const businessid = parseInt(req.params.businessid);
  try {
    const deleteSuccessful = await deleteBusinessById(businessid);
    
    if (deleteSuccessful) {
      res.status(204).end();
    } else {
      next();
    }
  } catch (err) {
    res.status(500).send({
      error: "Unable to delete business."
    });
  }

  async function deleteBusinessById(businessId) {
    const [ result ] = await mysqlPool.query(
      "DELETE FROM businesses WHERE id = ?",
      [ businessId ]
    );
    
    return result.affectedRows > 0;
  }
});
