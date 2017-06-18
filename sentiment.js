let csv = require('csv'),
	_ = require('lodash'),
	net = require('net'),
	fs = require('fs');
class Sentiment {
	constructor () {
		this._loadDic();
	}

	_loadDic () {
		this._polarity = this._loadKOSAC(`${__dirname}/dic/polarity.csv`);
		this._expressive_type = this._loadKOSAC(`${__dirname}/dic/expressive-type.csv`);
		this._intensity = this._loadKOSAC(`${__dirname}/dic/intensity.csv`);
	}

	_loadKOSAC (filePath) {
		let data;
		try {
			data = fs.readFileSync(filePath).toString();
		} catch (e) {
			console.log(filePath);
			throw e;
		}
		let lines = data.split('\n'),
			header = lines.reverse().pop();
		lines.reverse();
		return this._generateDic(header, lines);
	}

	_generateDic (header, lines) {
		let headers = header.split(','),
			ret = {};
		lines.forEach(line => {
			let row = line.split(','),
				ngram = row[0],
				ngramSplit = ngram.split(';'),
				data = {};
			headers.forEach((headerName, i) => {
				if (i > 0) {
					data[headerName] = row[i];
				}
			});
			_.set(ret, ngramSplit, data);
		});
		return ret;
	}
	
	morpheme (dataset, options = {}, callback) {
		options = Object.assign({
			host: 'localhost',
			port: 7000
		}, options);
		let client = new net.Socket(),
			host = options.host,
			port = options.port,
			self = this;
		const FINISH_FLAG = '__finished__';
		function checkFinished (data) {
			return (data.substr(-FINISH_FLAG.length) == FINISH_FLAG) ? true : false;
		}
		function eliminateFinished (data) {
			return data.substr(0, data.length-FINISH_FLAG.length);
		}
		function runParse () {
		}
		client.connect(port, host, () => {
			console.log(`[${host}:${port}]: Succeed connected. Send message length is: ${JSON.stringify(dataset).length}`);
			client.write(JSON.stringify(dataset)+FINISH_FLAG);
		});
		let dataCollection = '';
		client.on('data', data => {
			// client.destroy();
			data = data.toString();
			dataCollection += data;
			if (checkFinished(dataCollection)) {
				dataCollection = eliminateFinished(dataCollection);
				client.destroy();
			}
		});
		client.on('close', () => {
			console.log(`[${host}:${port}]: Succeed received message. Received message length is: ${dataCollection.length}`);
			let result = JSON.parse(dataCollection.toString());
			if (_.isArray(dataset)) {
				let alignedResult = [];
				result.forEach(elem => {
					alignedResult.push(self.alignMorpheme(elem));
				});
				callback(alignedResult);
			}
			if (_.isString(dataset)) {
				callback(self.alignMorpheme(result));
			}
		});
	}

	alignMorpheme (morpheme) {
		let ret = [];
		morpheme.forEach(elem => {
			ret.push(`${elem[0]}/${elem[1]}`);
		});
		return ret;
	}

	calc (keyPairs, source, target, func) {
		keyPairs.forEach(keyPair => {
			let sourceKey = keyPair[0],
				targetKey = keyPair[1],
				sourceData = source[sourceKey];
			if (sourceData != null) {
				if (_.isString(sourceData)) {
					sourceData = parseFloat(sourceData);
				}
				if (_.isNumber(sourceData)) {
					target[targetKey] = func(sourceData, target[targetKey]);
				}
			}
		});
	}

	percentage (obj) {
		let keys = Object.keys(obj),
			values = Object.values(obj);
		values = _.map(values, value => { return value/_.sum(values); });
		return _.zipObject(keys, values);
	}

	match (data, pairData, keyPairs) {
		let self = this,
			p = pairData,
			ret = _.zipObject(_.map(keyPairs, o => { return o[1]; }),
							  _.fill(_.map(keyPairs, o => { return o[1]; }), 0));
		let beforeData = null,
			currentData = null;
		data.forEach(m => {
			if (beforeData == null) {
				currentData = p[m];
			} else {
				currentData = _.get(beforeData, m);
				if (currentData != null) {
					self.calc(keyPairs, beforeData, ret, (sData, tData) => {
						return tData - sData;
					});
				}
			}
			if (currentData != null) {
				self.calc(keyPairs, currentData, ret, (sData, tData) => {
					return tData + sData;
				});
			}
			beforeData = currentData;
		});
		
		return this.percentage(ret);
	}

	polarity (data) {
		return this.match(data,
						  this._polarity,
						  [['COMP', 'com'],
						   ['POS', 'pos'],
						   ['NEG', 'neg'],
						   ['NEUT', 'neut'],
						   ['None', 'none']]);
	}

	intensity (data) {
		return this.match(data,
						  this._intensity,
						  [['High', 'high'],
						   ['Low', 'low'],
						   ['Medium', 'meium'],
						   ['None', 'none']]);
	}

	expressive (data) {
		return this.match(data,
						  this._expressive_type,
						  [['dir-action', 'dir-action'],
						   ['dir-explicit', 'dir-explicit'],
						   ['dir-speech', 'dir-speech'],
						   ['indirect', 'indirect'],
						   ['writing-device', 'writing-device']]);
	}

	analyze (dataset) {
		if (!_.isArray(dataset)) {
			throw new Error('The dataset has to be array type.');
		}
		let self = this;
		let ret = {};
		dataset.forEach(data => {
			['polarity', 'intensity', 'expressive'].forEach(type => {
				if (ret[type] == null) {
					ret[type] = [];
				}
				ret[type].push(self[type](data));
			});
		});
		return ret;
	}

	parse (dataset, options, callback) {
		let self = this;
		this.morpheme (dataset, options, result => {
			callback(self.analyze(result));
		});
	}
}

module.exports = new Sentiment();
