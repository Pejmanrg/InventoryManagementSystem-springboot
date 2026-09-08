# =====================================================================
#  Cloud Inventory Management System - front-end prototype
#
#  Static HTML/CSS/JS served by nginx. There is no build step: the files
#  are plain ES5 with no bundler, so they are copied as-is.
#
#  Cloud Run sends traffic to port 8080, so nginx is configured to listen
#  there rather than on nginx's default 80.
# =====================================================================

FROM nginx:1.27-alpine

# Replace the packaged default site with our own server block.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# The prototype itself. .dockerignore keeps the build files out of the image.
COPY . /usr/share/nginx/html

EXPOSE 8080
