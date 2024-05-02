const router = require('express').Router();

exports.router = router;

const { businesses } = require('./businesses');
const { reviews } = require('./reviews');
const { photos } = require('./photos');

const mysqlPool = require('../lib/mysqlPool')

/*
 * Route to list all of a user's businesses.
 */
router.get('/:userid/businesses', function (req, res) {
  const userid = parseInt(req.params.userid);
  try {
    const businesses = getBusinessesById(userid);
    if (businesses) {
      res.status(200).send(businesses);
    } else {
      next();
    }
  } catch (err) {
    res.status(500).send({
      error: "Unable to fetch businesses."
    })
  }

  async function getBusinessesById(userID) {
    const [ results ] = await mysqlPool.query(
      "SELECT * FROM businesses WHERE ownerid = ?",
      [ userID ],
    );

    return results[0];
  }
});


/*
 * Route to list all of a user's reviews.
 */
router.get('/:userid/reviews', function (req, res) {
  const userid = parseInt(req.params.userid);
  const userReviews = reviews.filter(review => review && review.userid === userid);
  res.status(200).json({
    reviews: userReviews
  });
});

/*
 * Route to list all of a user's photos.
 */
router.get('/:userid/photos', function (req, res) {
  const userid = parseInt(req.params.userid);
  const userPhotos = photos.filter(photo => photo && photo.userid === userid);
  res.status(200).json({
    photos: userPhotos
  });
});
