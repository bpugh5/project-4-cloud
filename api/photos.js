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

        connection.query('SELECT * FROM photos, businesses', function (error, results, fields) {
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
    `CREATE TABLE IF NOT EXISTS photos (
      id MEDIUMINT NOT NULL AUTO_INCREMENT,
      userid INT NOT NULL,
      businessid MEDIUMINT NOT NULL,
      caption varchar(255),
      PRIMARY KEY (id),
      INDEX idx_userid (userid)
    );`
  );
  mysqlPool.query(
    `ALTER TABLE photos
    ADD FOREIGN KEY (businessid) REFERENCES businesses(id);`
  )
}

init();

exports.router = router;

/*
 * Schema describing required/optional fields of a photo object.
 */
const photoSchema = {
  userid: { required: true },
  businessid: { required: true },
  caption: { required: false }
};


/*
 * Route to create a new photo.
 */
router.post('/', async function (req, res, next) {
  if (validateAgainstSchema(req.body, photoSchema)) {
    try {
      const id = await insertNewPhoto(req.body);
      res.status(201).send({id: id});
    } catch (err) {
      res.status(500).send({
        error: "Error inserting photo into DB."
      });
    }
  } else {
    res.status(400).json({
      error: "Request body is not a valid photo object"
    });
  }

  // Inserts photo into database
  async function insertNewPhoto(photo) {
    const validatedPhoto = extractValidFields(photo, photoSchema);

    const [ result ] = await mysqlPool.query(
      "INSERT INTO photos SET ?", validatedPhoto
    );

    return result.insertId;
  }
});

/*
 * Route to fetch info about a specific photo.
 */
router.get('/:photoID', async function (req, res, next) {
  const photoID = parseInt(req.params.photoID);
  try {
    const photo = await getPhotoById(photoID);
    if (photo) {
      res.status(200).send(photo);
    } else {
      next();
    }
  } catch (err) {
    res.status(500).send({
      error: "Unable to fetch photo."
    })
  }

  async function getPhotoById(photoID) {
    const [ results ] = await mysqlPool.query(
      "SELECT * FROM photos WHERE id = ?",
      [ photoID ],
    );

    return results[0];
  }
});

/*
 * Route to update a photo.
 */
router.put('/:photoID', async function (req, res, next) {
  const photoID = parseInt(req.params.photoID);
  if (validateAgainstSchema(req.body, photoSchema)) {
    try {
      const updateSuccessful = await updatePhotoById(photoID, req.body);
      if (updateSuccessful) {
        res.status(200).send({});
      } else {
        next();
      }
    } catch (err) {
      res.status(500).send({
        error: "Unable to update photo."
      });
    }
  } else {
    res.status(400).json({
      error: "Request body does not contain a valid photo."
    });
  }

  async function updatePhotoById(photoID, photo) {
    const validatedPhoto = extractValidFields(photo, photoSchema);
    const [ result ] = await mysqlPool.query(
      "UPDATE photos SET ? WHERE id = ?",
      [ validatedPhoto, photoID ]
    );

    return result.affectedRows > 0;
  }
});

/*
 * Route to delete a photo.
 */
router.delete('/:photoID', async function (req, res, next) {
  const photoID = parseInt(req.params.photoID);
  try {
    const deleteSuccessful = await deletePhotoById(photoID);
    
    if (deleteSuccessful) {
      res.status(204).send();
    } else {
      next();
    }
  } catch (err) {
    res.status(500).send({
      error: "Unable to delete photo."
    });
  }

  async function deletePhotoById(photoID) {
    const [ result ] = await mysqlPool.query(
      "DELETE FROM photos WHERE id = ?",
      [ photoID ]
    );
    
    return result.affectedRows > 0;
  }
});