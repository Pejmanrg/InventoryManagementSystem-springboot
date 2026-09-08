# =====================================================================
#  Cloud Inventory Management System - front-end prototype
#
#  Static HTML/CSS/JS served by nginx. No build step: the files are plain
#  ES5 with no bundler, so they are copied as-is.
#
#  Cloud Run sends traffic to port 8080, so nginx listens there rather
#  than on its default port 80.
# =====================================================================

FROM nginx:1.27-alpine

# Replace the packaged default site with our own server block.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# The prototype itself.
COPY . /usr/share/nginx/html

# nginx.conf has to be in the build context for the COPY above, which means
# it also lands in the web root. Remove it so the server config is not
# publicly readable.
RUN rm -f /usr/share/nginx/html/nginx.conf

EXPOSE 8080
