odoo.define('intl_tel_widget.phone_widget', function (require) {
"use strict";

let fieldRegistry = require('web.field_registry');
let FieldPhone = require('web.basic_fields').FieldPhone;
let Class = require('web.Class');
let rpc = require('web.rpc');
let core = require('web.core');
let _lt = core._lt;


/**
 * Queries country codes from res.country model.
 */
let CountryService = Class.extend({
    init: function () {
        let self = this;
        this.countries = {};
        this.codes = {};
        rpc.query({
            model: 'res.country',
            method: 'search_read',
            args: [[], ['id', 'code']],
        }).then(function (result) {
            result.forEach(function (item) {
                self.countries[item.id] = item.code.toLowerCase();
                self.codes[item.code.toLowerCase()] = item.id;
            });
        });
    },
});

let countryService = new CountryService();

let FieldIntlPhone = FieldPhone.extend({
    description: _lt("International Phone"),
    className: 'o_field_intl_phone',
    prefix: 'tel',
    resetOnAnyFieldChange: true,
    events: _.extend({}, FieldPhone.prototype.events, {
        "countrychange input": "_onCountryChange",
    }),

    init: function () {
        this._super.apply(this, arguments);
        this.tagName = this.mode === 'readonly' ? 'a' : 'div';
        this.iti = null;

        this.nodeOptions = _.defaults(this.nodeOptions, {
            allow_dropdown: true,
            exclude_country_codes: [],
            only_country_codes: [],
            preferred_country_codes: [],
            phone_number_type: "MOBILE",
            phone_number_format_type: "E164",
            separate_dial_code: false,
            initial_country_code: undefined,
            sync_country: true,
        });
        this.allowDropdown = this.nodeOptions.allow_dropdown;
        this.excludeCountries = this.nodeOptions.exclude_country_codes;
        this.onlyCountries = this.nodeOptions.only_country_codes;
        this.preferredCountries = this.nodeOptions.preferred_country_codes;
        this.initialCountry = this.nodeOptions.initial_country_code;
        this.placeholderNumberType = this.nodeOptions.phone_number_type;
        this.separateDialCode = this.nodeOptions.separate_dial_code;
        this.phoneNumberFormatType = this.nodeOptions.phone_number_format_type;
        this.phoneNumberFormat = intlTelInputUtils.numberFormat[this.phoneNumberFormatType];
        this.syncWithCountry = this.nodeOptions.sync_country;

        this._setCountry();
    },

    /**
     * Bind intlTelInput and mask plugins when rendering in edit mode.
     *
     * @override
     * @private
     */
    _renderEdit: function () {
        if (this.$('input').length === 0) {
            this.$el.append('<input />')
        }
        this.$input = this.$('input');
        this.$input.addClass('o_input');
        let inputAttrs = { type: 'text', autocomplete: this.attrs.autocomplete };
        this.$input.attr(inputAttrs);

        this.iti = this.$input.data('plugin_intlTelInput');
        if (!this.iti) {
            this.$input.intlTelInput({
                allowDropdown: this.allowDropdown,
                preferredCountries: this.preferredCountries,
                excludeCountries: this.excludeCountries,
                onlyCountries: this.onlyCountries,
                initialCountry: this.countryCode || this.initialCountry,
                placeholderNumberType: this.placeholderNumberType,
                separateDialCode: this.separateDialCode,
                customPlaceholder: this._getExampleNumber.bind(this),
            });
            this.iti = this.$input.data('plugin_intlTelInput');
        } else if (this.countryCode) {
            this.iti.setCountry(this.countryCode);
        }
        if (this.value) {
            let natNumber = intlTelInputUtils.formatNumber(this.value, this.countryCode, intlTelInputUtils.numberFormat.NATIONAL);
            this.iti._updateValFromNumber(natNumber);
        }

        this._setMasked();
    },

    /**
     * Check if phone is valid number.
     *
     * @override
     * @returns {boolean}
     */
    isValid: function () {
        let res = this._super.apply(this, arguments);
        if (!!this.value && this.iti) {
            res = res && this.iti.isValidNumber();
        }
        return res;
    },

    /**
     * @override
     * @private
     */
    _getValue: function () {
        let val = '';
        if (this.phoneNumberFormatType === 'SAME') {
            val = this.$input && this.$input.cleanVal();
        } else {
            val = this.iti && this.iti.getNumber(this.phoneNumberFormat);
        }
        return val;
    },

    /**
     * Format input number.
     *
     * @override
     * @private
     * @param {integer|string} value
     * @returns {string}
     */
    _formatValue: function (value) {
        let val = intlTelInputUtils.formatNumber(value, this.countryCode, intlTelInputUtils.numberFormat.E164);
        return this._super(val);
    },

    /**
     * Get formatted number from input.
     *
     * @private
     * @param {string} value
     * @returns {any}
     */
    _parseValue: function (value) {
        let val = this._getValue();
        return this._super(val || value);
    },

    /**
     * Re-gets the country as its value may have changed.
     *
     * @override
     * @private
     */
    _reset: function () {
        this._super.apply(this, arguments);
        this._setCountry();
    },

    /**
     * Set country code.
     */
    _setCountry: function () {
        if (this.syncWithCountry) {
            let countryField = this.nodeOptions.country_field || 'country_id';
            let countryID = this.record.data[countryField] && this.record.data[countryField].res_id;
            let countryCode = countryService.countries[countryID];
            if (countryCode && this.onlyCountries.length && !this.onlyCountries.find(function (iso) { return iso === countryCode; })) {
                countryCode = undefined;
            }
            if (countryCode && this.excludeCountries.length && this.excludeCountries.find(function (iso) { return iso === countryCode; })) {
                countryCode = undefined;
            }
            this.countryCode = countryCode;
        }
    },

    /**
     * Trigger on country change.
     */
    _onCountryChange: function (ev) {
        if (this.syncWithCountry) {
            this.isDirty = true;
            let countryField = this.nodeOptions.country_field || 'country_id';
            let foundCountryWidget = this.__parentedParent.allFieldWidgets[this.record.id].find(function(item) {return item.name===countryField});
            let countryId = countryService.codes[this.iti.getSelectedCountryData().iso2];
            if (foundCountryWidget && foundCountryWidget.value.res_id !== countryId) {
                foundCountryWidget._setValue(countryId);
            }
            this.isDirty = false;
        } else {
            this._setMasked();
        }
    },

    /**
     * Get example number based on country code and number type.
     */
    _getExampleNumber: function () {
        let countryCode = this.countryCode;
        if (!countryCode && this.iti) {
            countryCode = this.iti.getSelectedCountryData().iso2;
        }
        if (arguments.length === 2 && arguments[1].iso2) {
            countryCode = arguments[1].iso2;
        }
        let numberType = intlTelInputUtils.numberType[this.placeholderNumberType];
        return intlTelInputUtils.getExampleNumber(countryCode, true, numberType);
    },

    /**
     * Set input masked.
     */
    _setMasked: function () {
        let inputNumber = this._getExampleNumber();
        let inputMask = inputNumber.replace(/\d/g, '0');
        this.$input.unmask(inputMask);
        this.$input.mask(inputMask);
    },

    /**
     * @override
     */
    destroy: function () {
        if (this.mode === 'edit') {
            this.$input.unmask();
            if (this.iti) {
                this.iti.destroy();
                this.iti = null;
            }
        }
        this._super.apply(this, arguments);
    }

});

fieldRegistry.add('phone_intl', FieldIntlPhone);

});