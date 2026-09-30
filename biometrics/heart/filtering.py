'''
# Original Author:

- **Paul van Gent**
- [HeartPy on PyPI](https://pypi.org/project/heartpy/)
- [GitHub Repository](https://github.com/paulvangentcom/heartrate_analysis_python)
- [Heart Rate Analysis for Human Factors: Development and Validation of an Open-Source Toolkit for Noisy Naturalistic Heart Rate Data](https://www.researchgate.net/publication/325967542_Heart_Rate_Analysis_for_Human_Factors_Development_and_Validation_of_an_Open_Source_Toolkit_for_Noisy_Naturalistic_Heart_Rate_Data)
- [Analysing Noisy Driver Physiology in Real-Time Using Off-the-Shelf Sensors: Heart Rate Analysis Software from the Taking the Fast Lane Project](https://www.researchgate.net/publication/328654252_Analysing_Noisy_Driver_Physiology_Real-Time_Using_Off-the-Shelf_Sensors_Heart_Rate_Analysis_Software_from_the_Taking_the_Fast_Lane_Project?channel=doi&linkId=5bdab2c84585150b2b959d13&showFulltext=true)

Functions for data filtering tasks.
'''

from scipy.signal import butter, filtfilt, iirnotch, savgol_filter
import numpy as np

from heart.datautils import MAD

__all__ = ['filter_signal',
           'hampel_filter',
           'hampel_correcter',
           'smooth_signal']


def butter_lowpass(cutoff, sample_rate, order=2):
    '''standard lowpass filter.

    Function that defines standard Butterworth lowpass filter

    Parameters
    ----------
    cutoff : int or float
        frequency in Hz that acts as cutoff for filter.
        All frequencies above cutoff are filtered out.

    sample_rate : int or float
        sample rate of the supplied signal

    order : int
        filter order, defines the strength of the roll-off
        around the cutoff frequency. Typically orders above 6
        are not used frequently.
        default: 2

    Returns
    -------
    out : tuple
        numerator and denominator (b, a) polynomials
        of the defined Butterworth IIR filter.

    Examples
    --------
    >>> b, a = butter_lowpass(cutoff = 2, sample_rate = 100, order = 2)
    >>> b, a = butter_lowpass(cutoff = 4.5, sample_rate = 12.5, order = 5)
    '''
    nyq = 0.5 * sample_rate
    normal_cutoff = cutoff / nyq
    b, a = butter(order, normal_cutoff, btype='low', analog=False)
    return b, a


def butter_highpass(cutoff, sample_rate, order=2):
    '''standard highpass filter.

    Function that defines standard Butterworth highpass filter

    Parameters
    ----------
    cutoff : int or float
        frequency in Hz that acts as cutoff for filter.
        All frequencies below cutoff are filtered out.

    sample_rate : int or float
        sample rate of the supplied signal

    order : int
        filter order, defines the strength of the roll-off
        around the cutoff frequency. Typically orders above 6
        are not used frequently.
        default : 2

    Returns
    -------
    out : tuple
        numerator and denominator (b, a) polynomials
        of the defined Butterworth IIR filter.

    Examples
    --------
    we can specify the cutoff and sample_rate as ints or floats.

    >>> b, a = butter_highpass(cutoff = 2, sample_rate = 100, order = 2)
    >>> b, a = butter_highpass(cutoff = 4.5, sample_rate = 12.5, order = 5)
    '''
    nyq = 0.5 * sample_rate
    normal_cutoff = cutoff / nyq
    b, a = butter(order, normal_cutoff, btype='high', analog=False)
    return b, a


def butter_bandpass(lowcut, highcut, sample_rate, order=2):
    '''standard bandpass filter.
    Function that defines standard Butterworth bandpass filter.
    Filters out frequencies outside the frequency range
    defined by [lowcut, highcut].

    Parameters
    ----------
    lowcut : int or float
        Lower frequency bound of the filter in Hz

    highcut : int or float
        Upper frequency bound of the filter in Hz

    sample_rate : int or float
        sample rate of the supplied signal

    order : int
        filter order, defines the strength of the roll-off
        around the cutoff frequency. Typically orders above 6
        are not used frequently.
        default : 2

    Returns
    -------
    out : tuple
        numerator and denominator (b, a) polynomials
        of the defined Butterworth IIR filter.

    Examples
    --------
    we can specify lowcut, highcut and sample_rate as ints or floats.

    >>> b, a = butter_bandpass(lowcut = 1, highcut = 6, sample_rate = 100, order = 2)
    >>> b, a = butter_bandpass(lowcut = 0.4, highcut = 3.7, sample_rate = 72.6, order = 2)
    '''
    nyq = 0.5 * sample_rate
    low = lowcut / nyq
    high = highcut / nyq
    b, a = butter(order, [low, high], btype='band')
    return b, a


def filter_signal(
        data,
        cutoff,
        sample_rate,
        order=2,
        filtertype='lowpass',
        return_top=False
):
    if filtertype.lower() == 'bandpass':
        assert type(cutoff) == tuple or list or np.array, 'if bandpass filter is specified, \
cutoff needs to be array or tuple specifying lower and upper bound: [lower, upper].'
        b, a = butter_bandpass(cutoff[0], cutoff[1], sample_rate, order=order)
    elif filtertype.lower() == 'notch':
        b, a = iirnotch(cutoff, Q=0.005, fs=sample_rate)
    elif filtertype.lower() == 'lowpass':
        b, a = butter_lowpass(cutoff, sample_rate, order=order)
    elif filtertype.lower() == 'highpass':
        b, a = butter_highpass(cutoff, sample_rate, order=order)
    else:
        raise ValueError('filtertype: %s is unknown, available are: \
lowpass, highpass, bandpass, and notch' % filtertype)

    filtered_data = filtfilt(b, a, data)

    if return_top:
        return np.clip(filtered_data, a_min=0, a_max=None)
    else:
        return filtered_data


def remove_baseline_wander(data, sample_rate, cutoff=0.05):
    return filter_signal(
        data=data,
        cutoff=cutoff,
        sample_rate=sample_rate,
        filtertype='notch'
    )


def hampel_filter(data, filtsize=6):
    '''Detect outliers based on hampel filter

    Funcion that detects outliers based on a hampel filter.
    The filter takes datapoint and six surrounding samples.
    Detect outliers based on being more than 3std from window mean.
    See:
    https://www.mathworks.com/help/signal/ref/hampel.html

    Parameters
    ----------
    data : 1d list or array
        list or array containing the data to be filtered

    filtsize : int
        the filter size expressed the number of datapoints
        taken surrounding the analysed datapoint. a filtsize
        of 6 means three datapoints on each side are taken.
        total filtersize is thus filtsize + 1 (datapoint evaluated)

    Returns
    -------
    out :  array containing filtered data

    '''

    # generate second list to prevent overwriting first
    # cast as array to be sure, in case list is passed
    output = np.copy(np.asarray(data))
    onesided_filt = filtsize // 2
    for i in range(onesided_filt, len(data) - onesided_filt - 1):
        dataslice = output[i - onesided_filt: i + onesided_filt]
        mad = MAD(dataslice)
        median = np.median(dataslice)
        if output[i] > median + (3 * mad):
            output[i] = median
    return output


def hampel_correcter(data, sample_rate):
    '''apply altered version of hampel filter to suppress noise.

    Function that returns te difference between data and 1-second
    windowed hampel median filter. Results in strong noise suppression
    characteristics, but relatively expensive to compute.

    Result on output measures is present but generally not large. However,
    use sparingly, and only when other means have been exhausted.

    Parameters
    ----------
    data : 1d numpy array
        array containing the data to be filtered

    sample_rate : int or float
        sample rate with which data was recorded

    Returns
    -------
    out : 1d numpy array
        array containing filtered data


    '''

    return data - hampel_filter(data, filtsize=int(sample_rate))


def quotient_filter(RR_list, RR_list_mask=[], iterations=2):
    '''applies a quotient filter

    Function that applies a quotient filter as described in
    "Piskorki, J., Guzik, P. (2005), Filtering Poincare plots"

    Parameters
    ----------
    RR_list - 1d array or list
        array or list of peak-peak intervals to be filtered

    RR_list_mask - 1d array or list
        array or list containing the mask for which intervals are
        rejected. If not supplied, it will be generated. Mask is
        zero for accepted intervals, one for rejected intervals.

    iterations - int
        how many times to apply the quotient filter. Multipled
        iterations have a stronger filtering effect
        default : 2

    Returns
    -------
    RR_list_mask : 1d array
        mask for RR_list, 1 where intervals are rejected, 0 where
        intervals are accepted.

    Examples
    --------
    Given some example data let's generate an RR-list first
    >>> import heartpy as hp
    >>> data, timer = hp.load_exampledata(1)
    >>> sample_rate = hp.get_samplerate_mstimer(timer)
    >>> wd, m = hp.process(data, sample_rate)
    >>> rr = wd['RR_list']
    >>> rr_mask = wd['RR_masklist']

    Given this data we can use this function to further clean the data:
    >>> new_mask = quotient_filter(rr, rr_mask)

    Although specifying the mask is optional, as you may not always have a
    pre-computed mask available:
    >>> new_mask = quotient_filter(rr)

    '''

    if len(RR_list_mask) == 0:
        RR_list_mask = np.zeros((len(RR_list)))
    else:
        assert len(RR_list) == len(RR_list_mask), \
            'error: RR_list and RR_list_mask should be same length if RR_list_mask is specified'

    for iteration in range(iterations):
        for i in range(len(RR_list) - 1):
            if RR_list_mask[i] + RR_list_mask[i + 1] != 0:
                pass  # skip if one of both intervals is already rejected
            elif 0.8 <= RR_list[i] / RR_list[i + 1] <= 1.2:
                pass  # if R-R pair seems ok, do noting
            else:  # update mask
                RR_list_mask[i] = 1
                # RR_list_mask[i + 1] = 1

    return np.asarray(RR_list_mask)


def smooth_signal(data, sample_rate, window_length=None, polyorder=3):
    '''smooths given signal using savitzky-golay filter

    Function that smooths data using savitzky-golay filter using default settings.

    Functionality requested by Eirik Svendsen. Added since 1.2.4

    Parameters
    ----------
    data : 1d array or list
        array or list containing the data to be filtered

    sample_rate : int or float
        the sample rate with which data is sampled

    window_length : int or None
        window length parameter for savitzky-golay filter, see Scipy.signal.savgol_filter docs.
        Must be odd, if an even int is given, one will be added to make it uneven.
        default : 0.1  * sample_rate

    polyorder : int
        the order of the polynomial fitted to the signal. See scipy.signal.savgol_filter docs.
        default : 3

    Returns
    -------
    smoothed : 1d array
        array containing the smoothed data

    Examples
    --------
    Given a fictional signal, a smoothed signal can be obtained by smooth_signal():

    >>> x = [1, 3, 4, 5, 6, 7, 5, 3, 1, 1]
    >>> smoothed = smooth_signal(x, sample_rate = 2, window_length=4, polyorder=2)
    >>> np.around(smoothed[0:4], 3)
    array([1.114, 2.743, 4.086, 5.   ])

    If you don't specify the window_length, it is computed to be 10% of the
    sample rate (+1 if needed to make odd)
    >>> import heartpy as hp
    >>> data, timer = hp.load_exampledata(0)
    >>> smoothed = smooth_signal(data, sample_rate = 100)

    '''

    if window_length is None:
        window_length = sample_rate // 10

    if window_length % 2 == 0:
        window_length += 1

    smoothed = savgol_filter(data, window_length=window_length,
                             polyorder=polyorder)

    return smoothed
