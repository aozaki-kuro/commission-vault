#!/bin/fish

LOCAL_DIR="./public/images/"
REMOTE_DIR="root@jp-dmit:/var/www/share/nsfw-commission/"

rsync -avc $LOCAL_DIR $REMOTE_DIR
