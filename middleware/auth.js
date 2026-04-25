// Middleware: must be logged in
export const requireLogin = (req, res, next) => {
  if (!req.session.userId) return res.redirect("/login");
  next();
};

// Middleware: must be admin
export const requireAdmin = (req, res, next) => {
  if (!req.session.userId) return res.redirect("/login");
  if (req.session.userRole !== "admin") return res.redirect("/user/dashboard");
  next();
};

// Middleware: must be agency responder
export const requireAgency = (req, res, next) => {
  if (!req.session.userId) return res.redirect("/login");
  if (!["bfp","pnp","ems","admin"].includes(req.session.userRole)) return res.redirect("/user/dashboard");
  next();
};

// Middleware: must be user OR admin viewing as user
export const requireUser = (req, res, next) => {
  if (!req.session.userId) return res.redirect("/login");
  next();
};
