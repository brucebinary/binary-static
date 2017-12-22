const fs      = require('fs');
const { po }  = require('gettext-parser');
const Gettext = require('node-gettext');
const Path    = require('path');
const common  = require('./common');

Gettext.prototype.dnpgettext = function(domain, msg_txt, msg_id, msg_id_plural, count) {
    let default_translation = msg_id;
    let index;

    if (!isNaN(count) && count !== 1) {
        default_translation = msg_id_plural || msg_id;
    }

    /* eslint-disable no-underscore-dangle */
    const translation = this._getTranslation(domain, msg_txt || '', msg_id);
    /* eslint-enable no-underscore-dangle */

    if (translation) {
        if (typeof count === 'number') {
            /* eslint-disable no-undef */
            const pluralsFunc = plurals[Gettext.getLanguageCode(this.locale)].pluralsFunc;
            /* eslint-enable no-undef */
            index = pluralsFunc(count);
            if (typeof index === 'boolean') {
                index = index ? 1 : 0;
            }
        } else {
            index = 0;
        }

        return translation.msgstr[index] || default_translation;
    }
    // else
    this.emit('no-translation', msg_id); // changed default implementation here!

    return default_translation;
};

const createGettextInstance = () => {
    const translations_dir = 'src/translations/';
    const locales = [
        'en', 'ach_UG', 'fr_FR', 'it_IT', 'pt_PT', 'th_TH', 'zh_CN',
        'de_DE', 'es_ES', 'id_ID', 'ja_JP', 'pl_PL', 'ru_RU', 'vi_VN', 'zh_TW',
    ];

    const start = Date.now();
    process.stdout.write('Loading .po files '.cyan);
    const gt = new Gettext();

    locales.forEach((locale) => {
        const po_file = Path.join(common.root_path, translations_dir, `${locale}.po`);
        const po_content = fs.readFileSync(po_file, 'utf8');

        const parsed = po.parse(po_content);
        gt.addTranslations(locale, 'messages', parsed);
        process.stdout.write('.'.cyan);
    });
    process.stdout.write(' Done'.cyan);
    process.stdout.write(`  (${(Date.now() - start).toLocaleString()} ms)\n`.gray);

    const not_translated = [];
    gt.on('no-translation', (error) => {
        if (not_translated.indexOf(error) === -1) {
            not_translated.push(error);
        }
    });

    return {
        setLang: lang => {
            const [locale]  = locales.filter(l => l.toLocaleLowerCase().startsWith(lang));
            if (!locale) {
                throw new TypeError(`locale for ${lang} not found!`);
            }
            gt.setLocale(locale);
        },
        gettext: (text, ...args) => {
            let txt = text;
            for(let inx = 1; inx <= args.length; ++inx) {
                txt = txt.split(`[_${inx}]`).join(`%${inx}`);
            }
            let translation = gt.gettext(txt);
            for(let inx = 1; inx <= args.length; ++inx) {
                translation = translation.split(`%${inx}`).join(args[inx-1]);
            }
            return translation;
        },
        update_translations: () => {
            process.stdout.write('Updating translations ... '.green);
            if (not_translated.length === 0) {
                process.stdout.write('Skipped\n'.green);
                return;
            }
            const messages_file = Path.join(common.root_path, translations_dir, 'messages.pot');
            const content = fs.readFileSync(messages_file, 'utf8');
            const parsed = po.parse(content);

            not_translated.forEach(entry => {
                parsed.translations[''][entry] = {
                    msgid : entry,
                    msgstr: [''],
                };
            });

            const output = po.compile(parsed, {foldLength: 0});
            fs.writeFileSync(
                Path.join(common.root_path, translations_dir, 'messages.pot'),
                output,
                'utf8'
            );
            process.stdout.write(`Updated messages.pot with ${not_translated.length} new entries\n`.green);
        },
    };
};

let gt_instance = null;
exports.getInstance = () => {
    if (gt_instance) {
        return gt_instance;
    }

    gt_instance = createGettextInstance();
    return gt_instance;
};
