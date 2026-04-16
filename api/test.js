export default async function handler(req, res) {
  try {
    res.status(200).json({
      success: true,
      message: "API is working"
    });
  } catch (err) {
    console.error("Serverless Error:", err);

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
}