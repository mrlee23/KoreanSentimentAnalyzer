rm(list=ls(all=TRUE))
library(Hmisc) # list.tree
library(rlist) # list.map
library(rjson)
library(ggplot2)

calc.percentage <- function (data) {
    length = length(data)
    names = names(data[[1]])
    ret = list()
    for (name in names) {
        d = list.apply(data, function (x) {
            if (is.null(unlist(x[name], use.names=FALSE))) {
                return(0)
            } else {
                return(x[name])
            }
        })
        ret[name] = (sum(unlist(d)))/length
    }
    return(ret)
}

calc.sentiment <- function (data) {
    polarity = list.map(data, return(polarity))
    polarity.result = calc.percentage(polarity)
    return(list(polarity=polarity.result))
}

calc.count <- function (data) {
    retweets = sum(unlist(list.map(data, return(retweets))))
    favorites = sum(unlist(list.map(data, return(favorites))))
    return(list(tweets = length(data), retweets = retweets, favorites = favorites))
}


gen.dataset <- function (file.jsons) {
    ret = list()
    for (file.json in file.jsons) {
        ## calcData = list(date=file.name,
                        ## polarity=calc.sentiment(json, 'polarity'),
        ## intensity=calc.sentiment(json, 'intensity'))
        calcData = list.merge(list(data=file.json$date), calc.sentiment(file.json$data), calc.count(file.json$data))
        ret = list.append(ret, calcData)
    }
    return(ret)
}

load.json <- function (file.names) {
    ret = list()
    for (file.name in file.names) {
        json = load.jsonFile(file.name)
        tmp = list(date=file.name, data=json)
        ret = list.append(ret, tmp)
    }
    return(ret)
}
file.list = system("ls ./results | sed 's/\\.json//g'", intern = TRUE)
plot.sentiment <- function (dataset) {
    names = unlist(list.map(dataset, return(date)))
    names = c(1:length(dataset))
    pos = unlist(list.map(dataset, return(polarity$pos)))
    neg = unlist(list.map(dataset, return(polarity$neg)))
    neut = unlist(list.map(dataset, return(polarity$neut)))
    plot(x=names, y=0.5, ylim=c(0:1), type="l", col="blue")
    lines(pos, type="l", col="blue")
    lines(neg, type="l", col="red")
    lines(neut, type="l", col="gray")
}
ggplot.sentiment <- function (dataset) {
    # 감성그래프
    names = as.Date(unlist(list.map(dataset, return(data))))
    pos = unlist(list.map(dataset, return(polarity$pos)))
    neg = unlist(list.map(dataset, return(polarity$neg)))
    neut = unlist(list.map(dataset, return(polarity$neut)))
    df = data.frame(
        x = names,
        middle = pos*0+0.5,
        pos = pos,
        pos.label = 'Positive',
        neg = neg,
        neg.label = 'Negative',
        neut = neut,
        neut.label = 'Neutral'
    )
    color.pos = "blue"
    color.neg = "red"
    color.neut = "green"
    size.dot = 0
    gp = ggplot(df, aes(x, middle)) ## + geom_line()
    gp + ylim(0, 0.5) +
        geom_point(aes(x, pos), color = color.pos, size = size.dot) + geom_line(aes(x, pos), color = color.pos) +
        geom_point(aes(x, neg), color = color.neg, size = size.dot) + geom_line(aes(x, neg), color = color.neg) +
        geom_point(aes(x, neut), color = color.neut, size = size.dot) + geom_line(aes(x, neut), color = color.neut) +
        scale_x_date(date_labels = "%m-%d", date_breaks = "1 day") +
        theme(axis.text.x = element_text(angle = 270, hjust = 1))
        ## theme(axis.text.x = element_blank(),
    ##       axis.ticks = element_blank())
}
ggplot.tweets <- function (dataset) {
    # 트윗 수 그래프
    names = as.Date(unlist(list.map(dataset, return(data))))
    tw = unlist(list.map(dataset, return(tweets)))
    rt = unlist(list.map(dataset, return(retweets)))
    ## fv = unlist(list.map(dataset, return(favorites)))
    df = data.frame(
        x = names,
        pos = tw,
        pos.label = 'Positive',
        neg = rt,
        neg.label = 'Negative'
        ## neut = fv,
        ## neut.label = 'Neutral',
        )
    color.pos = "blue"
    color.neg = "red"
    color.neut = "green"
    size.dot = 0
    gp = ggplot(df) ## + geom_line()
    gp + geom_point(aes(x, pos), color = color.pos, size = size.dot) + geom_line(aes(x, pos), color = color.pos) +
        geom_point(aes(x, neg), color = color.neg, size = size.dot) + geom_line(aes(x, neg), color = color.neg) +
        ## geom_point(aes(x, neut), color = color.neut, size = size.dot) + geom_line(aes(x, neut), color = color.neut) +
        scale_x_date(date_labels = "%m-%d", date_breaks = "1 day") +
        theme(axis.text.x = element_text(angle = 270, hjust = 1))
    ## theme(axis.text.x = element_blank(),
    ##       axis.ticks = element_blank())
}
ggplot.issue <- function (dataset) {
    names = as.Date(unlist(list.map(dataset, return(data))))
    tw = unlist(list.map(dataset, return(tweets)))
    rt = unlist(list.map(dataset, return(retweets)))
    ## fv = unlist(list.map(dataset, return(favorites)))
    pos = unlist(list.map(dataset, return(polarity$pos)))
    neg = unlist(list.map(dataset, return(polarity$neg)))
    neut = unlist(list.map(dataset, return(polarity$neut)))
    is = (tw+rt)*(abs(pos-neg)+0.00001)
    diff = is-c(0, is[1:length(is)-1])
    df = data.frame(
        x = names,
        pos = is,
        pos.label = 'Positive',
        neg = tw,
        neg.label = 'Negative',
        neut = neut,
        neut.label = 'Neutral',
        diff = diff
    )
    color.pos = "blue"
    color.neg = "red"
    color.neut = "green"
    size.dot = 0
    gp = ggplot(df) ## + geom_line()
    gp + geom_point(aes(x, is), color = color.pos, size = size.dot) + geom_line(aes(x, is), color = color.pos) +
        geom_bar(stat = "identity", aes(x, diff), color = color.neg) + 
        ## geom_point(aes(x, neg), color = color.neg, size = size.dot) + geom_line(aes(x, neg), color = color.neg) +
        ## geom_point(aes(x, neut), color = color.neut, size = size.dot) + geom_line(aes(x, neut), color = color.neut) +
        scale_x_date(date_labels = "%m-%d", date_breaks = "1 day") +
        theme(axis.text.x = element_text(angle = 270, hjust = 1))
        ## theme(axis.text.x = element_blank(),
        ##       axis.ticks = element_blank())
}
ggplot.slope <- function (dataset) {
    # 트윗 수 변화량 그래프
    names = as.Date(unlist(list.map(dataset, return(data))))
    pos = unlist(list.map(dataset, return(polarity$pos)))
    neg = unlist(list.map(dataset, return(polarity$neg)))
    neut = unlist(list.map(dataset, return(polarity$neut)))
    t = unlist(list.map(dataset, return(tweets)))
    rt = unlist(list.map(dataset, return(retweets)))
    fv = unlist(list.map(dataset, return(favorites)))
    re = (t+rt+fv)*(abs(pos-neg)+0.0001)
    df = data.frame(
        x = names,
        pos = t,
        pos.label = 'Positive',
        neg = rt,
        neg.label = 'Negative',
        neut = fv,
        neut.label = 'Neutral'
    )
    color.pos = "blue"
    color.neg = "red"
    color.neut = "green"
    size.dot = 0
    gp = ggplot(df) ## + geom_line()
    gp + geom_point(aes(x, pos), color = color.pos, size = size.dot) + geom_line(aes(x, pos), color = color.pos) +
        geom_point(aes(x, neg), color = color.neg, size = size.dot) + geom_line(aes(x, neg), color = color.neg) +
        geom_point(aes(x, neut), color = color.neut, size = size.dot) + geom_line(aes(x, neut), color = color.neut) +
        scale_x_date(date_labels = "%m-%d", date_breaks = "1 day") +
        theme(axis.text.x = element_text(angle = 270, hjust = 1))
        ## theme(axis.text.x = element_blank(),
        ##       axis.ticks = element_blank())
}

ggplot.sentiment(dataset)
