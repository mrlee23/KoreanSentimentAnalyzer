#!/usr/bin/env node
let path = require('path'),
	_ = require('lodash'),
	moment = require('moment'),
	fs = require('fs'),
	deasync = require('deasync'),
	rescape = require('regexp.escape'),
	ls = require('ls'),
	sentiment = require('korean-sentiment-analyzer').sentiment;
let dataDir,
	resultDir;

function align (twData, resultData) {
	let ret = [],
		resultAlign = [];
	_.forEach(resultData, (value, key) => {
		twData = _.merge(twData, _.map(value, o => { let obj = {}; obj[key] = o; return obj;}));
	});
	// ret = _.merge(twData, resultAlign);
	return twData;
}

function parse (twData, options = {}, callback) {
	options = Object.assign({
		host: 'localhost',
		port: 7000
	}, options);
	// twData = twData.slice(0,800);
	let text = _.map(twData, 'text'),
		ret = {};
	sentiment.parse(text, options, result => {
		result = align(twData, result);
		callback(result);
	});
}
function removeOverheadChar (text) {
	let tObj = {},
		standard = 8,
		newText = [],
		flag = false;
	text.split(' ').forEach(sText => {
		_.forEach(sText, t => {
			if (t != ' ') {
				tObj[t] = tObj[t] == null ? 1 : tObj[t] + 1;
			}
		});
		let overheadChar = _.keys(_.pickBy(tObj, t => { return t > standard; }));
		overheadChar.forEach(char => {
			let overlap = _.remove(sText.split(char), c => { return c == ''; });
			if (overlap.length > standard) {
				flag = true;
				let tmp = '___*tmp*___';
				sText = sText.replace(new RegExp(rescape(char)), tmp);
				sText = sText.replace(new RegExp(rescape(char), 'g'), '');
				sText = sText.replace(tmp, char);
			}
			sText = sText.replace(/[ㄱ-ㅎㅏ-ㅢ-_=\+\*\[\]\{\}\(\)\^\$%#@!&%\\]+/g, matched => {
				if (matched.length > standard) {
					return '';
				} else {
					return matched;
				}
			});
		});
		newText.push(sText);
	});
	newText = newText.join(' ');
	if (flag) {
		// console.log(" ");
		// console.log(`> ${text}`);
		// console.log(`> ${newText}`);
	}
	return newText;
}
function removeUrl (text) {
	return text.replace(/(?:https?|ftp):\/\/[\n\S]+/g, '');
}
function filter (twData) {
	let text = _.map(twData, 'text');
	_.forEach(twData, obj => {
		obj.raw = obj.text;
		obj.text = removeOverheadChar(removeUrl(obj.text));
		if (obj.text.replace(' ', '').length == 0) {
			obj.text = 'None';
		}
	});
	return twData;
}
function analyze (fileNames) {
	let count = 0,
		portNum = 7000,
		portCount = 3,
		listenCount = 10;
	fileNames.forEach(fileName => {
		let filePath = path.resolve(dataDir, `${fileName}.json`),
			resultFilePath = path.resolve(resultDir, `${fileName}.json`);
		fs.readFile(filePath, (err, data) => {
			if (err) {
				throw err;
			}
			console.log(`[${fileName}]: Finished read file`);
			let twData = filter(JSON.parse(data.toString()));
			if (count > 0 && (count % listenCount) == 0) {
				portNum = 7000 + (count%portCount);
			}
			count += 1;
			parse(twData,
				  {host: 'localhost',
				   port: portNum},
				   result => {
					  fs.writeFile(resultFilePath, JSON.stringify(result), result => {
						  if (err) {
							  throw err;
						  }
						  console.log(`[${fileName}]: Succeed write result`);
					  });
				  });
		});
	});
}
function analyzeSync (fileNames, hostname, port) {
	let portLimit = port + 10;
	fileNames.forEach(fileName => {
		let filePath = path.resolve(dataDir, `${fileName}.json`),
			resultFilePath = path.resolve(resultDir, `${fileName}.json`),
			data, twData, tdLength, tdInterval = 100, tdPointer = 0, tdResult = [], breakFlag = false;
		console.log(`\n[${fileName}]: Start analyzing...`);
		console.time(`[${fileName}]`);
		data = fs.readFileSync(filePath).toString();
		console.log(`[${fileName}]: Finished read file`);
		twData = filter(JSON.parse(data));
		tdLength = twData.length;
		while (tdLength >= tdPointer) {
			let currentTd;
			if ((tdLength - tdPointer) <= tdInterval) {
				currentTd = twData.slice(tdPointer, tdLength);
			} else {
				currentTd = twData.slice(tdPointer, tdPointer+tdInterval);
			}
			try {
				breakFlag = false;
				console.time(`[${fileName}]: parse time`);
				parse(currentTd,
					  {host: hostname,
					   port: port},
					  result => {
						  tdResult = tdResult.concat(result);
						  console.timeEnd(`[${fileName}]: parse time`);
						  console.log(`[${fileName}]: Succeed parsed data. The pointer is: ${tdPointer}/${tdLength}`);
						  breakFlag = true;
					  });
				while (breakFlag == false) {
					deasync.sleep(300);
				}
				tdPointer += tdInterval;
			} catch (e) {
				tdPointer += tdInterval;
				if (portLimit < port) {
					console.log(`[${fileName}]: Occured error at point: ${tdPointer}, portLimit: ${portLimit}. exit`);
					process.exit(1);
				}
				port += 1;
				console.log(`[${fileName}]: Occured error at point: ${tdPointer}`);
			}
		}
		fs.writeFileSync(resultFilePath, JSON.stringify(tdResult));
		console.timeEnd(`[${fileName}]`);
	});
}
function main (host, port, start, end) {
	let files = _.compact(_.map(ls(`${dataDir}/*`), o => {
		let name = o.file.split('.')[0],
		m = moment(name);
		if (m.isSameOrAfter(start) && m.isSameOrBefore(end)) {
			return name;
		} else {
			return null;
		}
	}));
	analyzeSync(files, host, parseInt(port));
}
const helpText = `ksa-client <host> <port> <first date> <last date> <source dir> <target dir>
Example
> ksa-client localhost 7000 2017-01-01 2017-02-01 ./data ./results
`;
let argv = process.argv;
if (argv.length < 8) {
	console.log(helpText);
	process.exit(1);
}
dataDir = argv[6];
resultDir = argv[7];
[dataDir, resultDir].forEach(dir => {
	if (!fs.lstatSync(dir).isDirectory()) {
		console.log(helpText);
		throw new Error(`Directory is not exist('${dir}').`);
	}
});
main(argv[2], argv[3], argv[4], argv[5]);
