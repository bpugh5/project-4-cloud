const router = require('express').Router();
const { validateAgainstSchema, extractValidFields } = require('../lib/validation');

const mysqlPool = require('../lib/mysqlPool');

// Simulate delay in code for database connection
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Loop until the database is set up
async function loop() {
  while (true) {
    try {
      // This code was derived from https://github.com/mysqljs/mysql?tab=readme-ov-file#pooling-connections
      await mysqlPool.getConnection(function(err, connection) {
        if (err) throw err;

        connection.query('SELECT * FROM reviews, businesses', function (error, results, fields) {
          // When done with the connection, release it.
          connection.release();
      
          // Handle error after the release.
          if (error) throw error;
        });
      });
      break;
    } catch {
      await sleep(2000)
    }
  }
}

// Builds table after awaiting database connection
async function init() {
  await loop();
  await mysqlPool.query(
    `CREATE TABLE IF NOT EXISTS reviews (
      id MEDIUMINT NOT NULL AUTO_INCREMENT,
      userid INT NOT NULL,
      businessid MEDIUMINT NOT NULL,
      dollars INT NOT NULL,
      stars INT NOT NULL,
      review varchar(255),
      PRIMARY KEY (id),
      INDEX idx_userid (userid)
    );`
  );
  mysqlPool.query(
    `ALTER TABLE reviews
    ADD FOREIGN KEY (businessid) REFERENCES businesses(id);`
  );
}

init();

exports.router = router;

/*
 * Schema describing required/optional fields of a review object.
 */
const reviewSchema = {
  userid: { required: true },
  businessid: { required: true },
  dollars: { required: true },
  stars: { required: true },
  review: { required: false }
};

let posted;
let modified;

/*
 * Route to create a new review.
 */
router.post('/', async function (req, res, next) {
  if (validateAgainstSchema(req.body, reviewSchema)) {
    try {
      const id = await insertNewReview(req.body);
      res.status(201).send({id: id});
    } catch (err) {
      // If a post has already been made, tell the user that.
      if (posted) {
        res.status(403).json({
          error: "User has already posted a review of this business"
        });
      } else {
        res.status(500).send({
          error: "Error inserting review into DB."
        });
      }
    }
  } else {
    res.status(400).json({
      error: "Request body is not a valid review object"
    });
  }

  async function checkUserReviewCount(userID, businessID) {
    const [ result ] = await mysqlPool.query(
      "SELECT COUNT(*) FROM reviews WHERE userid = ? AND businessid = ?",
      [ userID, businessID],
    );

    // Once a post has been made, no more should be allowed to be created
    if (result[0]["COUNT(*)"] >= 1) {
      return true;
    } else {
      return false;
    }
  }

  // Insert review into the database
  async function insertNewReview(review) {
    const validatedReview = extractValidFields(review, reviewSchema);
    posted = await checkUserReviewCount(validatedReview.userid, validatedReview.businessid);

    if (posted == true) {
      throw err;
    }
    const [ result ] = await mysqlPool.query(
      "INSERT INTO reviews SET ?", validatedReview
    );

    return result.insertId;
  }
});

/*
 * Route to fetch info about a specific review.
 */
router.get('/:reviewID', async function (req, res, next) {
  const reviewID = parseInt(req.params.reviewID);
  
  try {
    const review = await getReviewById(reviewID);
    if (review) {
      res.status(200).send(review);
    } else {
      next();
    }
  } catch (err) {
    res.status(500).send({
      error: "Unable to fetch review."
    })
  }

  async function getReviewById(reviewID) {
    const [ results ] = await mysqlPool.query(
      "SELECT * FROM reviews WHERE id = ?",
      [ reviewID ],
    );

    return results[0];
  }
});

/*
 * Route to update a review.
 */
router.put('/:reviewID', async function (req, res, next) {
  const reviewID = parseInt(req.params.reviewID);
  if (validateAgainstSchema(req.body, reviewSchema)) {
    try {
      const updateSuccessful = await updateReviewById(reviewID, req.body);
      if (updateSuccessful) {
        res.status(200).send({});
      } else {
        next();
      }
    } catch (err) {
      if (modified) {
        res.status(403).json({
          error: "Updated review cannot modify businessid or userid"
        });
      } else {
        res.status(500).send({
          error: "Unable to update review."
        });
      }
    }
  } else {
    res.status(400).json({
      error: "Request body does not contain a valid review."
    });
  }

  async function checkReviewEditParams(reviewID) {
    const [ result ] = await mysqlPool.query(
      "SELECT userid, businessid FROM reviews WHERE id = ?",
      [ reviewID ],
    );

    if (result[0]["userid"] == parseInt(req.body.userid) && 
        result[0]["businessid"] == parseInt(req.body.businessid)) {
      return false;
    } else {
      return true;
    }
  }

  async function updateReviewById(reviewID, review) {
    const validatedReview = extractValidFields(review, reviewSchema);
    modified = checkReviewEditParams(reviewID);
    // if perms fit, then update, otherwise throw
    if (modified) {
      const [ result ] = await mysqlPool.query(
        "UPDATE reviews SET ? WHERE id = ?",
        [ validatedReview, reviewID ],
      );
      return result.affectedRows > 0;
    } else {
      throw err;
    }

  }
});

/*
 * Route to delete a review.
 */
router.delete('/:reviewID', async function (req, res, next) {
  const reviewID = parseInt(req.params.reviewID);
  try {
    const deleteSuccessful = await deleteReviewById(reviewID);
    
    if (deleteSuccessful) {
      res.status(204).send();
    } else {
      next();
    }
  } catch (err) {
    res.status(500).send({
      error: "Unable to delete review."
    });
  }

  async function deleteReviewById(reviewID) {
    const [ result ] = await mysqlPool.query(
      "DELETE FROM reviews WHERE id = ?",
      [ reviewID ]
    );
    
    return result.affectedRows > 0;
  }
});