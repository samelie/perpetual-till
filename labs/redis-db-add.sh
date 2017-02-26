#!/bin/bash

curl -k "http://download.maxmind.com/download/worldcities/worldcitiespop.txt.gz" -o "worldcitiespop.txt.gz"
gzip -d worldcitiespop.txt.gz
rm worldcitiespop.txt.gz
npm i
node country_parse.js
