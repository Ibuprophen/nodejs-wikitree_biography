/** @module g2gx converts parsed GEDCOM to GedcomX */
/** @author Coert Vonk <my name at gmail> */

var GedcomX = require('gedcomx-js');  // install using 'npm install', details at https://github.com/rootsdev/gedcomx-js

var get = require('./get.js'),
    value = require('./value.js');

    // Enable the RS and Records extensions
GedcomX.enableRsExtensions();
GedcomX.enableRecordsExtensions();

/* Create a name by specifying the parts.
 *
 * @param {Object} nameParts
 * @returns {Person}
 * inspired by https://github.com/rootsdev/genscrape/src/gedx-extensions.js
 */
GedcomX.Person.prototype.addNameFromParts = function(nameParts) {

  let nameForm = GedcomX.NameForm();
  for(let type in nameParts){
    if(nameParts[type]){
      nameForm.addPart({
        type: type,
        value: nameParts[type]
      });
    }
  }
  this.addName(GedcomX.Name()
    .addNameForm(nameForm));
  return this;
};

/**
 * Create a fact from type, date and place.
 *
 * @param {Object} dateParts
 * @returns {Person}
 */
GedcomX.Person.prototype.addTypeDatePlace = function(type, date, place) {    

    let fact = GedcomX.Fact();
    fact.setType(type);
    if (date && date.length) {
        fact.setDate(GedcomX.Date()
            .setOriginal(date));
    }
    if (place && place.length) {
        fact.setPlace(GedcomX.PlaceReference()
            .setOriginal(place));
    }
    this.addFact(fact);
    return this;
};

/**
 * Add an ID generator to each GedcomX document. Allows you to easily generate
 * IDs that are unique within one document. Currently it's just a counter
 * that starts at 1 and increases each time it's called.
 *
 * @returns {String}
 * inspired by https://github.com/rootsdev/genscrape/src/gedx-extensions.js
 */
GedcomX.Root.prototype.generateId = function(){
    if(typeof this._nextId === 'undefined'){
      this._nextId = 0;
    }
    return ++this._nextId + '';
};

GedcomX.Root.prototype.addPersonGedcom = function(gedcom, indi, relationshipType) {
    if (indi) {
        let id = 'coertvonk.com as ' + indi.id.replace(/^@|@$/g, '');
        let person = GedcomX.Person({id: id, // this.generateId(),
                                    resource: indi.id,
                                    resourceId: 'https://coertvonk.com/genealogy/' + indi.id,  // 2BD: maybe resource and resourceId need to be swapped
                                    principal: relationshipType == undefined,
                                    identifiers: {'genscrape': indi.id}})
            .setGender({type: 'http://gedcomx.org/' + get.byTemplate(gedcom, indi, undefined, '[SEX:gedcomx]')})
            .addNameFromParts({'http://gedcomx.org/Given': get.byTemplate(gedcom, indi, undefined, '[NAME:given]'),
                               //'http://gedcomx.org/Middle': get.byTemplate(gedcom, indi, undefined, '[NAME:middle]'),
                               'http://gedcomx.org/Preferred': get.byTemplate(gedcom, indi, undefined, '[NAME:given]'),
                               'http://gedcomx.org/Surname': get.byTemplate(gedcom, indi, undefined, '[NAME:last]')})
            .addTypeDatePlace('http://gedcomx.org/Birth', 
                get.byTemplate(gedcom, indi, undefined, '[BIRT.DATE:wtgedcomx]'), 
                get.byTemplate(gedcom, indi, undefined, '[BIRT.PLAC:full]'))
            .addTypeDatePlace('http://gedcomx.org/Death', 
                get.byTemplate(gedcom, indi, undefined, '[DEAT.DATE:wtgedcomx]'), 
                get.byTemplate(gedcom, indi, undefined, '[DEAT.PLAC:full]'));

        this.addPerson(person);
        if (relationshipType) {
            let relData = {
                type: relationshipType,
                person1: {
                    resourceId: person.id,
                    resource: 'https://coertvonk.com/genealogy/' + person.id
                },
                person2: {
                    resourceId: this.persons[0].id,
                    resource: 'https://coertvonk.com/genealogy/' + this.persons[0].id
                }
            }
            this.addRelationship(relData);
        }            
    }
    return this;
}

module.exports = {
    agent: function () {
        let agent = GedcomX.Agent()
            .setId('agent')
            .addName(({lang: 'nl', value: 'Coert Vonk'}))
            .setHomepage({resource: 'https://coertvonk.com'});
        return agent;
    },
    sourceDescription: function (gedcom, indi) {
        let name = get.byTemplate(gedcom, indi, undefined, '[NAME:full]');
        let sourceDescription = GedcomX.SourceDescription()
            .setAbout("https://coertvonk.com/genealogy")
            .addTitle({value: name + ' from GEDCOM'})
            .addCitation({value: 'GEDCOM file accessed ' + value.currentDate() + ' for ' + name})
            .setRepository({resource: '#agent'});
        return sourceDescription;
    },
    principal: function(gedcom, indi) {
        if (indi) {
            let father = get.byName(gedcom, indi, 'FAMC.HUSB');
            let mother = get.byName(gedcom, indi, 'FAMC.WIFE');
            father = father ? father[0] : undefined;
            mother = mother ? mother[0] : undefined;

            let sourceDescription = module.exports.sourceDescription(gedcom, indi);
            let gedcomx = new GedcomX()
                .addPersonGedcom(gedcom, indi)
                .addPersonGedcom(gedcom, father, 'http://gedcomx.org/ParentChild')
                .addPersonGedcom(gedcom, mother, 'http://gedcomx.org/ParentChild')
                .addAgent()
                .addSourceDescription(sourceDescription);
            //console.log(JSON.stringify(gedcomx));
            return gedcomx;
        }
    }
};
